import React, { useEffect, useState, useRef } from "react";
import { updateMusicState, listenToMusicState } from "../firebase/firestore";
import './MusicPlayer.css';

function MusicPlayer({ chatId, user, isVisible, onClose }) {
  const [songName, setSongName] = useState("");
  const [videoId, setVideoId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState("");
  const [loading, setLoading] = useState(false);
  const playerRef = useRef(null);

  // Listen to real-time music state from Firestore
  useEffect(() => {
    if (!chatId || !isVisible) return;

    const unsubscribe = listenToMusicState(chatId, (musicState) => {
      if (musicState) {
        console.log("Music state update:", musicState);
        
        // Only update if the change came from another user
        if (musicState.updatedBy !== user.uid) {
          if (musicState.videoId && musicState.videoId !== videoId) {
            setVideoId(musicState.videoId);
            setCurrentlyPlaying(musicState.title || "Unknown Song");
            if (playerRef.current) {
              playerRef.current.loadVideoById(musicState.videoId);
              if (musicState.isPlaying) {
                playerRef.current.playVideo();
              }
            }
          }
          setIsPlaying(musicState.isPlaying || false);
        }
      }
    });

    return unsubscribe;
  }, [chatId, isVisible, user.uid, videoId]);

  // Search and play ANY song using YouTube
  const searchAndPlaySong = async () => {
    if (!songName.trim()) {
      alert("Please enter a song name");
      return;
    }

    setLoading(true);
    try {
      // Method 1: Use YouTube Data API v3 (Most Reliable)
      const videoData = await searchYouTube(songName);
      
      if (videoData) {
        playSong(videoData);
      } else {
        throw new Error("No results found");
      }

    } catch (error) {
      console.error("Error searching song:", error);
      alert("Error searching for song. Please try again.");
    }
    setLoading(false);
  };

  // Search YouTube for any song
  const searchYouTube = async (query) => {
    try {
      // Using YouTube Data API v3 with your API key
      const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY ; 
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}&key=${API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

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
      console.error("YouTube search failed:", error);
      // Fallback to alternative search method
      return await searchYouTubeAlternative(query);
    }
  };

  // Alternative YouTube search method
  const searchYouTubeAlternative = async (query) => {
    try {
      // Using a different search approach
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
          return {
            videoId: video.id,
            title: video.title,
            duration: video.duration
          };
        }
      }
      return null;
    } catch (error) {
      console.error("Alternative search failed:", error);
      return null;
    }
  };

  const playSong = (video) => {
    console.log("Playing song:", video);
    setVideoId(video.videoId);
    setCurrentlyPlaying(video.title);
    setIsPlaying(true);
    setSongName("");

    // Update Firestore with new song
    updateMusicState(chatId, {
      videoId: video.videoId,
      title: video.title,
      isPlaying: true,
      updatedBy: user.uid,
      timestamp: new Date()
    });

    // Load and play the video
    if (playerRef.current) {
      playerRef.current.loadVideoById(video.videoId);
      playerRef.current.playVideo();
    }
  };

  const togglePlayPause = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    // Update Firestore
    updateMusicState(chatId, {
      videoId,
      title: currentlyPlaying,
      isPlaying: newPlayingState,
      updatedBy: user.uid,
      timestamp: new Date()
    });

    // Control YouTube player
    if (playerRef.current) {
      if (newPlayingState) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  };

  const stopMusic = () => {
    if (playerRef.current) {
      playerRef.current.stopVideo();
    }
    setIsPlaying(false);
    setCurrentlyPlaying("");
    setVideoId("");
    setSongName("");

    updateMusicState(chatId, {
      videoId: "",
      title: "",
      isPlaying: false,
      updatedBy: user.uid,
      timestamp: new Date()
    });
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (!isVisible) return;

    // Load YouTube IFrame API
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
            console.log("YouTube player ready");
          },
          'onStateChange': (event) => {
            // Sync state changes back to Firestore
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              updateMusicState(chatId, {
                videoId,
                title: currentlyPlaying,
                isPlaying: true,
                updatedBy: user.uid,
                timestamp: new Date()
              });
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              updateMusicState(chatId, {
                videoId,
                title: currentlyPlaying,
                isPlaying: false,
                updatedBy: user.uid,
                timestamp: new Date()
              });
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              updateMusicState(chatId, {
                videoId,
                title: currentlyPlaying,
                isPlaying: false,
                updatedBy: user.uid,
                timestamp: new Date()
              });
            }
          },
          'onError': (event) => {
            console.error("YouTube player error:", event);
            // Try to handle specific errors
            if (event.data === 101 || event.data === 150) {
              alert("This video cannot be played in embedded players. Try a different song.");
            } else {
              alert("Error playing song. Try searching for a different version.");
            }
          }
        }
      });
    };

    // If YouTube API is already loaded, create player immediately
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
    <div className="musicPlayer">
      {/* Header */}
      <div className="header">
        <h3 className="title">🎵 Universal Music Player</h3>
        <button onClick={onClose} className="closeButton">×</button>
      </div>

      {/* Current Song Display */}
      {currentlyPlaying && (
        <div className="currentSong">
          <p className="nowPlaying">Now Playing:</p>
          <p className="songTitle">{currentlyPlaying}</p>
        </div>
      )}

      {/* Search Section */}
      <div className="searchSection">
        <div className="searchBox">
          <input
            type="text"
            placeholder="Enter ANY song name (e.g., let her go, tum hi ho, shape of you)..."
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

      {/* Controls */}
      <div className="controls">
        {videoId ? (
          <>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <button 
                onClick={togglePlayPause} 
                className={isPlaying ? "pauseButton" : "playButton"}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button 
                onClick={stopMusic}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                ⏹️ Stop
              </button>
            </div>
            <div className="syncInfo">
              <p>🎧 Both users hear the same full song in real-time</p>
              <p className="syncSub">Full songs from YouTube - No limitations!</p>
            </div>
          </>
        ) : (
          <div >
          </div>
        )}
      </div>

      {/* Hidden YouTube Player */}
      <div id="youtube-player"></div>
    </div>
  );
}

export default MusicPlayer;