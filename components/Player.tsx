import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Asset, AssetType, AssetScale, Campaign, Layout } from '../types';
import { server } from '../services/server';
import { CONFIG } from '../config';

const getProxyUrl = (url: string) => {
    // If it's already a proxied URL or an internal link, don't proxy again
    if (url.includes('/api/proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;

    // Detect if we are running locally or in production
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    const adminUrl = isLocal 
        ? `http://${window.location.hostname}:${CONFIG.LOCAL.DEFAULT_ADMIN_PORT}`
        : `https://${CONFIG.PRODUCTION.DOMAIN_ADMIN}`;
        
    return `${adminUrl}/api/proxy?url=${encodeURIComponent(url)}`;
};

const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/')) {
    return server.getServerUrl() + url;
  }
  return url;
};

interface PlayerProps {
  assets?: Asset[];
  campaign?: Campaign;
  layout?: Layout;
  onExit: () => void;
  rotation?: number; // 0, 90, 180, 270
  deviceId?: string;
  overlay?: string; // Global overlay
}

const getObjectFitStyle = (scale: AssetScale = AssetScale.FIT): React.CSSProperties['objectFit'] => {
  switch (scale) {
    case AssetScale.FILL: return 'cover';
    case AssetScale.STRETCH: return 'fill';
    case AssetScale.NONE: return 'none';
    case AssetScale.FIT:
    default: return 'contain';
  }
};

const getBackgroundSize = (scale: AssetScale = AssetScale.FIT): string => {
  switch (scale) {
    case AssetScale.FILL: return 'cover';
    case AssetScale.STRETCH: return '100% 100%';
    case AssetScale.NONE: return 'auto';
    case AssetScale.FIT:
    default: return 'contain';
  }
};

interface PersistentVideoPlayerProps {
  asset: Asset | null;
  assetsLength: number;
  shouldPlay: boolean;
  isVisible: boolean;
  onEnded: () => void;
  onError: () => void;
  onLog: (msg: string) => void;
}

// Tizen (Samsung TV) detection
const isTizen = typeof navigator !== 'undefined' && /Tizen/i.test(navigator.userAgent);

interface VideoPlayerProps {
  asset: Asset | null;
  assetsLength: number;
  shouldPlay: boolean;
  isVisible: boolean;
  onEnded: () => void;
  onError: () => void;
  onLog: (msg: string) => void;
}

const getMemorySnapshot = (): string => {
  if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
    const mem = (window.performance as any).memory;
    const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
    const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
    return `[RAM: ${usedMB}/${limitMB}MB]`;
  }
  return '';
};

const SingleVideoPlayer: React.FC<VideoPlayerProps> = ({
  asset,
  assetsLength,
  shouldPlay,
  isVisible,
  onEnded,
  onError,
  onLog,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFreezing, setIsFreezing] = useState(false);
  const isFreezingRef = useRef(false);

  const eventsRef = useRef({ onEnded, onError, onLog, asset, assetsLength, shouldPlay });
  eventsRef.current = { onEnded, onError, onLog, asset, assetsLength, shouldPlay };

  // Set video source and manage playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!asset || asset.type !== AssetType.VIDEO) {
      try {
        video.pause();
        video.currentTime = 0;
      } catch (e) {}
      return;
    }

    const safeUrl = resolveUrl(asset.url);
    const currentSrc = video.getAttribute('data-src');

    if (currentSrc !== safeUrl) {
      onLog(`[VIDEO-LOAD] "${asset.name}" url=${safeUrl.substring(0, 60)} count=${assetsLength} ${getMemorySnapshot()}`);
      video.setAttribute('data-src', safeUrl);
      video.muted = asset.muted !== undefined ? asset.muted : true;
      video.src = safeUrl;
      video.loop = assetsLength <= 1;
      video.load();
    } else {
      video.muted = asset.muted !== undefined ? asset.muted : true;
      video.loop = assetsLength <= 1;
      if (assetsLength > 1) {
        onLog(`[VIDEO-REPLAY] "${asset.name}" repeating same video URL from start`);
        try { video.currentTime = 0; } catch (e) {}
      }
    }

    if (shouldPlay) {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          onLog(`[VIDEO-PLAY-OK] "${asset.name}" readyState=${video.readyState}`);
        }).catch(e => {
          if (e.name !== 'AbortError') {
            onLog(`[VIDEO-PLAY-FAIL] "${asset.name}": ${e.name} ${e.message}`);
            if (!video.muted) {
              video.muted = true;
              video.play().catch(err => {
                if (err.name !== 'AbortError') {
                  eventsRef.current.onError();
                }
              });
            }
          }
        });
      }
    } else {
      try { video.pause(); } catch (e) {}
    }
  }, [asset?.url, asset?.id, shouldPlay, assetsLength]);

  // Event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hasAdvanced = false;
    let lastLogTick = 0;

    const captureFreezeFrame = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            try {
              ctx.drawImage(video, 0, 0);
              isFreezingRef.current = true;
              setIsFreezing(true);
            } catch (e) {}
          }
        }
      }
    };

    const handleCanPlay = () => {
      const { onLog, asset: a } = eventsRef.current;
      if (!a) return;
      onLog(`[VIDEO-CANPLAY] "${a.name}" res=${video.videoWidth}x${video.videoHeight} dur=${video.duration ? video.duration.toFixed(1) : '?'}s`);
    };

    const handlePlaying = () => {
      const { onLog, asset: a } = eventsRef.current;
      if (!a) return;
      if (isFreezingRef.current) {
        isFreezingRef.current = false;
        setIsFreezing(false);
      }
      onLog(`[VIDEO-PLAYING] "${a.name}" active rendering`);
    };

    const handleEnded = () => {
      const { onEnded, onLog, asset: a, assetsLength: len, shouldPlay: sp } = eventsRef.current;
      if (!a || len <= 1 || !sp) return;
      if (hasAdvanced) return;
      hasAdvanced = true;
      captureFreezeFrame();
      onLog(`[VIDEO-ENDED] "${a.name}" natural end -> advance ${getMemorySnapshot()}`);
      onEnded();
    };

    const handleTimeUpdate = () => {
      const { onEnded, onLog, asset: a, assetsLength: len, shouldPlay: sp } = eventsRef.current;
      if (!a || !sp) return;
      if (video.seeking) return;

      if (video.currentTime > 0.05 && isFreezingRef.current) {
        isFreezingRef.current = false;
        setIsFreezing(false);
      }

      const duration = video.duration;
      if (!duration || isNaN(duration)) return;

      const now = Date.now();
      // Log periodic status every 3 seconds
      if (now - lastLogTick >= 3000) {
        lastLogTick = now;
        onLog(`[VIDEO-TICK] "${a.name}" t=${video.currentTime.toFixed(1)}/${duration.toFixed(1)}s (${Math.round((video.currentTime / duration) * 100)}%) ${getMemorySnapshot()}`);
      }

      if (len <= 1) return;
      if (hasAdvanced) return;
      if (duration > 1 && video.currentTime < 0.5) return;

      const timeLeft = duration - video.currentTime;
      // Advance near the very end (0.15s) and snapshot last frame
      if (timeLeft <= 0.15) {
        hasAdvanced = true;
        captureFreezeFrame();
        onLog(`[VIDEO-NEAR-END] "${a.name}" t=${video.currentTime.toFixed(1)}/${duration.toFixed(1)}s -> advance ${getMemorySnapshot()}`);
        onEnded();
      }
    };

    const handleError = () => {
      const { onError, onLog, asset: a } = eventsRef.current;
      if (!a) return;
      const code = video.error ? video.error.code : 'UNKNOWN';
      const msg = video.error ? video.error.message : '';
      onLog(`[VIDEO-ERROR] "${a.name}" code=${code} ${msg} ${getMemorySnapshot()}`);
      onError();
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      try { video.pause(); } catch (e) {}
    };
  }, [asset?.id, asset?.url]);

  // Hide freeze-frame overlay when video player is not visible
  useEffect(() => {
    if (!isVisible) {
      isFreezingRef.current = false;
      setIsFreezing(false);
    }
  }, [isVisible]);

  const currentScale = asset ? asset.scale : 'FIT';

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: isVisible ? 'auto' : 'none', transform: 'translateZ(0)' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          objectFit: getObjectFitStyle(currentScale),
          display: (isFreezing && isVisible) ? 'block' : 'none',
          zIndex: 25,
          pointerEvents: 'none',
          transform: 'translateZ(0)',
        }}
      />
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          objectFit: getObjectFitStyle(currentScale),
          backgroundColor: 'black',
          opacity: isVisible ? 1 : 0,
          visibility: isVisible ? 'visible' : 'hidden',
          zIndex: isVisible ? 20 : 5,
          pointerEvents: isVisible ? 'auto' : 'none',
          transform: 'translateZ(0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
        preload="auto"
        playsInline
        webkit-playsinline="true"
        muted
      />
    </div>
  );
};

export const Player: React.FC<PlayerProps> = ({ assets, campaign, layout, onExit, rotation = 0, deviceId, overlay }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [canPreloadNext, setCanPreloadNext] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logBuffer = useRef<string[]>([]);

  const handleRemoteLog = useCallback((msg: string) => {
    const timestamp = new Date().toISOString();
    const formatted = typeof msg === 'string' && /^\[\d{4}-\d{2}-\d{2}/.test(msg) ? msg : `[${timestamp}] ${msg}`;
    console.log(formatted);
    logBuffer.current.push(formatted);
  }, []);



  // Remote Logging Flush Loop
  useEffect(() => {
    if (!deviceId || deviceId === 'preview') return;

    const flushLogs = async () => {
      if (logBuffer.current && logBuffer.current.length > 0) {
        const logsToSend = [...logBuffer.current];
        logBuffer.current = []; // Clear immediately to avoid dups
        server.sendDeviceLogs(deviceId, logsToSend).catch(console.error);
      }
    };

    // Batch logs into 5-second intervals to avoid flooding older TV's network stacks
    const interval = setInterval(flushLogs, 5000); 

    return () => {
      clearInterval(interval);
      flushLogs(); 
    };
  }, [deviceId]);

  const assetsLength = assets?.length || 0;

  useEffect(() => {
    if (assetsLength > 0 && currentIndex >= assetsLength) {
      setCurrentIndex(0);
    }
  }, [assetsLength, currentIndex]);

  const safeIndex = assetsLength > 0 ? currentIndex % assetsLength : 0;
  const currentAsset = assets?.[safeIndex];

  // Track currentIndex changes for Tizen transition diagnostics
  useEffect(() => {
    if (assetsLength === 0) return;
    handleRemoteLog(`[TRACE] Slide transition to index: ${safeIndex} (${currentAsset?.name || 'Unknown'})`);
  }, [safeIndex, currentAsset?.id, currentAsset?.name, assetsLength, handleRemoteLog]);

  const getYoutubeEmbedUrl = (url: string) => {
    try {
      let videoId = '';
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('embed/')[1].split('?')[0];
      }

      if (videoId) {
        const shouldLoop = !currentAsset?.playUntilDone;
        const params = [
          'autoplay=1',
          `mute=${currentAsset?.muted ? '1' : '0'}`,
          'controls=0',
          `loop=${shouldLoop ? '1' : '0'}`,
          'modestbranding=1',
          'showinfo=0',
          'rel=0',
          'playsinline=1',
          'enablejsapi=1'
        ];

        if (shouldLoop) {
          params.push(`playlist=${videoId}`); 
        }

        if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
          params.push(`origin=${window.location.origin}`);
        }

        return `https://www.youtube.com/embed/${videoId}?${params.join('&')}`;
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  const nextSlide = useCallback(() => {
    if (assetsLength === 0) return;
    setCurrentIndex((prev) => (prev + 1) % assetsLength);
  }, [assetsLength]);

  const prevSlide = useCallback(() => {
    if (assetsLength === 0) return;
    setCurrentIndex((prev) => (prev - 1 + assetsLength) % assetsLength);
  }, [assetsLength]);

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const handlePlayNow = (e: CustomEvent<string>) => {
      const assetId = e.detail;
      if (!assets) return;
      const index = assets.findIndex(a => a.id === assetId);
      if (index !== -1) {
        setCurrentIndex(index);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };
    window.addEventListener('storecast_play_now', handlePlayNow as EventListener);
    return () => window.removeEventListener('storecast_play_now', handlePlayNow as EventListener);
  }, [assets]);

  const enterFullscreen = useCallback(() => {
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { /* Ignore failure */ });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleInteraction();
      enterFullscreen(); 
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          prevSlide();
          break;
      }
    };

    const handleClick = () => {
      handleInteraction();
      enterFullscreen(); 
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [nextSlide, prevSlide, handleInteraction, enterFullscreen]);

  // Tizen-Optimized Preloading: Only load the next video 1.5s before the current one ends.
  // Many Tizen models stall if they attempt to claims the second decoder for too long.
  const playlistChecksum = (assets || []).map(a => a.id).sort().join('-');
  
  // Report State to Server
  useEffect(() => {
    if (deviceId && deviceId !== 'preview' && currentAsset?.id) {
      server.reportState(deviceId, currentAsset.id);
    }
  }, [deviceId, currentAsset?.id]);

    // PRELOAD REMOVED: Relying entirely on single-video strategy for ultimate stability

  // Load YouTube API ONLY if needed
  useEffect(() => {
    if (assets?.some(a => a.type === AssetType.YOUTUBE) && !(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [assets]);

  // Handle YouTube Play Until Done
  useEffect(() => {
    let player: any = null;
    let isMounted = true;
    if (currentAsset?.type === AssetType.YOUTUBE && currentAsset.playUntilDone) {
      const initPlayer = () => {
        if (!isMounted) return;
        if ((window as any).YT && (window as any).YT.Player) {
          if (document.getElementById('youtube-player-frame')) {
            player = new (window as any).YT.Player('youtube-player-frame', {
              events: {
                'onStateChange': (event: any) => {
                  if (event.data === 0) { // YT.PlayerState.ENDED
                    nextSlide();
                  }
                }
              }
            });
          }
        } else {
          setTimeout(initPlayer, 100);
        }
      };
      initPlayer();
    }
    return () => {
      isMounted = false;
    }
  }, [currentAsset?.id, currentAsset?.type, currentAsset?.playUntilDone, nextSlide]);

  // Slide Timer
  useEffect(() => {
    if (assetsLength === 0 || !currentAsset) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Video assets manage their own gapless transitions via SeamlessVideoPlayer
    if (currentAsset.type === AssetType.VIDEO) {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    if (currentAsset.type === AssetType.YOUTUBE && currentAsset.playUntilDone) {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    const parsedDuration = Number(currentAsset.duration);
    const duration = (parsedDuration > 0 ? parsedDuration : 10) * 1000;
    timerRef.current = setTimeout(() => {
      nextSlide();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [safeIndex, currentAsset?.id, currentAsset?.type, currentAsset?.duration, currentAsset?.playUntilDone, assetsLength, nextSlide]); 

  if (!campaign && (!assets || assets.length === 0 || !currentAsset)) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Playlist is empty</h2>
          {deviceId && (
            <p className="text-slate-500 font-mono text-sm">Device ID: {deviceId}</p>
          )}
        </div>
      </div>
    );
  }

  const containerRotation = rotation;
  const isContainerPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;

  const containerStyle: React.CSSProperties = (rotation === 0 || (isContainerPortrait && (containerRotation === 90 || containerRotation === 270))) ? {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: isTizen ? 'transparent' : 'black',
    transform: 'translateZ(0)',
    willChange: 'transform',
  } : {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: (containerRotation === 90 || containerRotation === 270) ? '100vh' : '100%',
    height: (containerRotation === 90 || containerRotation === 270) ? '100vw' : '100%',
    transform: `translate3d(-50%, -50%, 0) rotate(${containerRotation}deg)`,
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    backgroundColor: isTizen ? 'transparent' : 'black'
  };

  if (campaign && layout && layout.zones) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: 'black', position: 'relative', overflow: 'hidden' }}>
        <div style={containerStyle}>
          {layout.zones.map(zone => (
            <div key={zone.id} style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              width: `${zone.w}%`, height: `${zone.h}%`,
              overflow: 'hidden'
            }}>
               <Player
                  assets={campaign.zonePlaylists[zone.id] || []}
                  onExit={onExit}
                  rotation={0}
                  deviceId={undefined} // avoid duplicate logging
                  overlay={undefined}
               />
            </div>
          ))}
          {overlay && (
            <img src={overlay} alt="Overlay" className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-[9999]" />
          )}
        </div>
      </div>
    );
  }

  // Static identity to guarantee stable component rendering mapped purely through react bounds
  const uniqueKey = `asset-${currentAsset.id}`;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
        position: 'relative',
        overflow: 'hidden',
        cursor: showControls ? 'auto' : 'none'
      }}
      onClick={handleInteraction}
    >
      <div style={containerStyle}>
        
        {/* NON-VIDEO ASSETS */}
        {currentAsset.type === AssetType.IMAGE && (
          <img
            key={`img-${currentAsset.id}`}
            src={resolveUrl(currentAsset.url)}
            alt={currentAsset.name}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'black',
              objectFit: getObjectFitStyle(currentAsset.scale),
              zIndex: 30
            }}
          />
        )}
        
        {currentAsset.type === AssetType.WEBSITE && (
          <iframe
            key={`website-${currentAsset.id}`}
            src={getProxyUrl(resolveUrl(currentAsset.url))}
            title={currentAsset.name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              pointerEvents: 'none',
              zIndex: 20
            }}
            referrerPolicy="no-referrer"
          />
        )}
        
        {currentAsset.type === AssetType.YOUTUBE && (
          <iframe
            id="youtube-player-frame"
            key="persistent-youtube"
            src={getYoutubeEmbedUrl(resolveUrl(currentAsset.url))}
            title={currentAsset.name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              opacity: 0.999,
              transform: 'rotate3d(0, 0, 1, 0.0001deg)',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              perspective: '1000px',
              zIndex: 20
            }}
            allow="accelerometer; autoplay *; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}

        {/* ULTRA-STABLE SINGLE DECODER VIDEO PLAYER */}
        <SingleVideoPlayer
          key="single-player"
          asset={currentAsset?.type === AssetType.VIDEO ? currentAsset : null}
          assetsLength={assetsLength}
          shouldPlay={currentAsset?.type === AssetType.VIDEO}
          isVisible={currentAsset?.type === AssetType.VIDEO}
          onEnded={nextSlide}
          onError={nextSlide}
          onLog={handleRemoteLog}
        />

        {overlay && (
          <img
            key={`overlay-global`}
            src={resolveUrl(overlay)}
            alt="Overlay"
            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-[9999]"
          />
        )}
      </div>

      <div
        className={`absolute top-0 right-0 p-6 flex justify-end items-start transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="bg-black/60 px-4 py-2 rounded-lg text-sm text-white backdrop-blur font-mono border border-white/10 shadow-lg">
          {currentAsset.name} ({safeIndex + 1}/{assetsLength})
        </div>
      </div>
    </div>
  );
};
