import React, { useEffect, useState, useRef } from "react";
import { updateMusicState, listenToMusicState, listenToMusicQueue, loadOlderMusicQueue } from "../firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { KeepAwake } from '@capacitor-community/keep-awake';
import '../styles/MusicPlayer.css';

function MusicPlayer({ chatId, user, isVisible, onClose, pinned = false }) {
  const [songName, setSongName] = useState("");
  const [videoId, setVideoId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState("");
  const [loading, setLoading] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [queueCursor, setQueueCursor] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const playerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const keepAwakeActive = useRef(false);

  const requestWakeLock = async () => {
    try {
      
      if (Capacitor.isNativePlatform()) {
        if (!keepAwakeActive.current) {
          await KeepAwake.keepAwake();
          keepAwakeActive.current = true;
          console.log('KeepAwake enabled for audio playback');
        }
      } else if ('wakeLock' in navigator) {
        
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired for audio playback');
      }
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (Capacitor.isNativePlatform() && keepAwakeActive.current) {
        await KeepAwake.allowSleep();
        keepAwakeActive.current = false;
        console.log('KeepAwake disabled');
      } else if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock released');
      }
    } catch (err) {
      console.error('Failed to release wake lock:', err);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && isPlaying && playerRef.current) {
        
        await requestWakeLock();
        
        if (playerRef.current.getPlayerState && 
            playerRef.current.getPlayerState() !== window.YT?.PlayerState?.PLAYING) {
          playerRef.current.playVideo();
        }
      } else if (!document.hidden && !isPlaying) {
        await releaseWakeLock();
      }
    };

    const handleAppStateChange = async () => {
      
      if (Capacitor.isNativePlatform()) {
        document.addEventListener('resume', () => {
          if (isPlaying && playerRef.current) {
            playerRef.current.playVideo();
          }
        });
        
        document.addEventListener('pause', async () => {
          if (isPlaying) {
            await requestWakeLock();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleAppStateChange();
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isPlaying]);

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

  // Subscribe to recent music queue (last 50)
  useEffect(() => {
    if (!chatId || !isVisible) return;
    const unsubscribe = listenToMusicQueue(chatId, (queue) => {
      setQueueItems(queue);
      // If queue length is >= 50, there may be older items
      setQueueHasMore((queue || []).length >= 50);
      // Reset cursor when new items push in
      setQueueCursor(null);
    });
    return unsubscribe;
  }, [chatId, isVisible]);

  const loadOlderQueue = async () => {
    if (!queueHasMore || queueLoading) return;
    setQueueLoading(true);
    try {
      const { items, hasMore, nextCursor } = await loadOlderMusicQueue(chatId, 20, queueCursor);
      if (items.length > 0) {
        // Prepend older items
        setQueueItems(prev => [...items, ...prev]);
      }
      setQueueHasMore(hasMore);
      setQueueCursor(nextCursor);
    } catch (err) {
      console.error('Error loading older queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

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
        throw new Error("No results found from available providers");
      }
    } catch (error) {
      console.error("Error searching song:", error);
      alert("Error searching for song. Please try again.");
    }
    setLoading(false);
  };

  const normalizeVideo = (video) => {
    if (!video) return null;
    const videoId =
      video?.id?.videoId ||
      video?.videoId ||
      video?.id ||
      null;
    const title = video?.snippet?.title || video?.title || null;
    if (!videoId || !title) return null;
    return { videoId, title };
  };

  const searchYouTubeNoKey = async (query) => {
    try {
      const response = await fetch(
        `https://yt.lemnoslife.com/noKey/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.items?.length) return null;
      return normalizeVideo(data.items[0]);
    } catch (error) {
      return null;
    }
  };

  const searchYouTube = async (query) => {
    try {
      const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY; 
      if (!API_KEY) {
        const noKeyResult = await searchYouTubeNoKey(query);
        if (noKeyResult) return noKeyResult;
        return await searchYouTubeAlternative(query);
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}&key=${API_KEY}`
      );

      if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
      
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return normalizeVideo(data.items[0]);
      }
      const noKeyResult = await searchYouTubeNoKey(query);
      if (noKeyResult) return noKeyResult;
      return null;
    } catch (error) {
      const noKeyResult = await searchYouTubeNoKey(query);
      if (noKeyResult) return noKeyResult;
      return await searchYouTubeAlternative(query);
    }
  };

  const searchYouTubeAlternative = async (query) => {
    try {
      const rapidApiKey = process.env.REACT_APP_RAPIDAPI_KEY;
      if (!rapidApiKey) return null;

      const response = await fetch(
        `https://youtube-search-results.p.rapidapi.com/youtube-search/?q=${encodeURIComponent(query + " song official audio")}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'youtube-search-results.p.rapidapi.com',
            'x-rapidapi-key': rapidApiKey
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          return normalizeVideo(data.items[0]);
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
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: () => {
            console.log('YouTube player ready');
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              requestWakeLock(); 
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);
              releaseWakeLock(); 
            }
          },
          onError: () => {
            alert("Error playing song. Try a different version.");
            releaseWakeLock();
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
      releaseWakeLock();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="musicPlayerWrapper">
      {currentlyPlaying && (
        <div className="nowPlayingBar">
          <span className="nowPlayingText">Now Playing: </span>
          <span className="songNameText">{currentlyPlaying}</span>
        </div>
      )}
      <div className={`musicPlayer ${pinned ? 'pinned' : 'floating'}`}>
        <button onClick={onClose} className="closeButton" aria-label="Close music player">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="searchSection">
          <div className="searchBox">
            <input
              type="text"
              placeholder="Search for a song..."
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchAndPlaySong()}
              className="searchInput"
              disabled={loading}
            />
            <button 
              onClick={searchAndPlaySong} 
              className="music-control-button search-button"
              disabled={loading}
              aria-label="Search and play"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" />
                <line x1="16.511" y1="16.511" x2="22" y2="22" />
              </svg>
            </button>
          </div>
        </div>

        <div className="controls">
          {videoId && (
            <>
              <button 
                onClick={togglePlayPause} 
                className="music-control-button"
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              <button 
                onClick={stopMusic}
                className="music-control-button stop-button"
                aria-label="Stop"
                title="Stop"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {queueItems.length > 0 && (
          <div className="queueSection" style={{ marginTop: 8 }}>
            <div className="queueHeader" style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Queue</div>
            <div className="queueList" style={{ maxHeight: 120, overflowY: 'auto' }}>
              {queueItems.map((q, idx) => (
                <div key={`${q.videoId || q.id || 'item'}_${idx}`} className="queueItem" style={{ fontSize: 12, padding: '4px 0' }}>
                  {q.title || q.name || 'Unknown Title'}
                </div>
              ))}
            </div>
            {queueHasMore && (
              <button onClick={loadOlderQueue} className="loadOlderQueueButton" disabled={queueLoading} style={{ marginTop: 6, fontSize: 12 }}>
                {queueLoading ? 'Loading...' : 'Load older'}
              </button>
            )}
          </div>
        )}

        <div id="youtube-player"></div>
      </div>
    </div>
  );
}

export default MusicPlayer;