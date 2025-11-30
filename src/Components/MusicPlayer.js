import React, { useEffect, useState, useRef } from "react";
import { updateMusicState, listenToMusicState } from "../firebase/firestore";
import './MusicPlayer.css';

function MusicPlayer({ chatId, user, isVisible, onClose, pinned = false }) {
  const [songName, setSongName] = useState("");
  const [videoId, setVideoId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState("");
  const [loading, setLoading] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!chatId || !isVisible) return;

    const unsubscribe = listenToMusicState(chatId, (musicState) => {
      if (musicState && musicState.updatedBy !== user.uid) {
        if (musicState.videoId === videoId && 
            musicState.isPlaying === isPlaying &&
            musicState.title === currentlyPlaying) {
          return;
        }
        
        const currentVideoId = playerRef.current && playerRef.current.getVideoData ? 
          playerRef.current.getVideoData().video_id : null;
        
        const isDifferentVideo = musicState.videoId !== currentVideoId;
        
        setVideoId(musicState.videoId || "");
        setCurrentlyPlaying(musicState.title || "");
        setIsPlaying(musicState.isPlaying || false);
        
        setTimeout(() => {
          if (playerRef.current && playerRef.current.getVideoData) {
            if (musicState.videoId && isDifferentVideo) {
              playerRef.current.loadVideoById(musicState.videoId);
            }
            
            if (musicState.isPlaying) {
              playerRef.current.playVideo();
            } else {
              playerRef.current.pauseVideo();
            }
          }
        }, 100);
      }
    });
    return unsubscribe;
  }, [chatId, isVisible, user.uid, videoId, isPlaying, currentlyPlaying]);

  const searchAndPlaySong = async () => {
    if (!songName.trim()) {
      alert("Please enter a song name");
      return;
    }

    setLoading(true);
    try {
      const videoData = await searchYouTube(songName);
      if (videoData) {
        playSong(videoData);
      } else {
        throw new Error("No results found");
      }
    } catch (error) {
      alert("Error searching for song. Please try again.");
    }
    setLoading(false);
  };

  const searchYouTube = async (query) => {
    try {
      const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY; 
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}&key=${API_KEY}`
      );

      if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
      
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        return {
          videoId: video.id.videoId,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.default.url
        };
      }
      return null;
    } catch (error) {
      return await searchYouTubeAlternative(query);
    }
  };

  const searchYouTubeAlternative = async (query) => {
    try {
      const response = await fetch(
        `https://youtube-search-results.p.rapidapi.com/youtube-search/?q=${encodeURIComponent(query + " song official audio")}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'youtube-search-results.p.rapidapi.com',
            'x-rapidapi-key': '2cd3c5e367msh2f32234adae1671p1c6c99jsn7cfa8b7b28ba'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const video = data.items[0];
          return { videoId: video.id, title: video.title };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const playSong = (video) => {
    setVideoId(video.videoId);
    setCurrentlyPlaying(video.title);
    setIsPlaying(true);
    setSongName("");

    updateMusicState(chatId, {
      videoId: video.videoId,
      title: video.title,
      isPlaying: true,
      updatedBy: user.uid,
      timestamp: new Date()
    });

    if (playerRef.current) {
      playerRef.current.loadVideoById(video.videoId);
      playerRef.current.playVideo();
    }
  };

  const togglePlayPause = () => {
    if (!videoId) return;
    
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    updateMusicState(chatId, {
      videoId,
      title: currentlyPlaying,
      isPlaying: newPlayingState,
      updatedBy: user.uid,
      timestamp: new Date()
    });

    if (playerRef.current) {
      if (newPlayingState) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  };

  const stopMusic = () => {
    setVideoId("");
    setCurrentlyPlaying("");
    setIsPlaying(false);
    setSongName("");

    updateMusicState(chatId, {
      videoId: "",
      title: "",
      isPlaying: false,
      updatedBy: user.uid,
      timestamp: new Date()
    });

    if (playerRef.current) {
      playerRef.current.stopVideo();
    }
  };

  useEffect(() => {
    if (!isVisible) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          showinfo: 0,
          rel: 0,
          enablejsapi: 1
        },
        events: {
          'onReady': (event) => {
          },
          'onStateChange': (event) => {
            if (event.data === window.YT.PlayerState.PLAYING && !isPlaying) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED && isPlaying) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
            }
          },
          'onError': (event) => {
            alert("Error playing song. Try a different version.");
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={`musicPlayer ${pinned ? 'pinned' : 'floating'}`}>
      <div className="header">
        <button onClick={onClose} className="closeButton">×</button>
      </div>

      {currentlyPlaying && (
        <div className="currentSong">
          <p className="nowPlaying">Now Playing:</p>
          <p className="songTitle">{currentlyPlaying}</p>
        </div>
      )}

      <div className="searchSection">
        <div className="searchBox">
          <input
            type="text"
            placeholder="Enter ANY song name..."
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchAndPlaySong()}
            className="searchInput"
            disabled={loading}
          />
          <button 
            onClick={searchAndPlaySong} 
            className="searchButton"
            disabled={loading}
          >
            {loading ? '🔍 Searching...' : '🎵 Play Any Song'}
          </button>
        </div>
      </div>

      <div className="controls">
        {videoId ? (
          <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
            <button 
              onClick={togglePlayPause} 
              className={isPlaying ? "pauseButton" : "playButton"}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button 
              onClick={stopMusic}
              className="stopButton"
            >
              ⏹️ Stop
            </button>
          </div>
        ) : null}
      </div>

      <div id="youtube-player"></div>
    </div>
  );
}

export default MusicPlayer;