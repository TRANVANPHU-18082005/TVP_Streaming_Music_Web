import { useState, useRef, useEffect, useCallback } from 'react';
import { IMashupShort } from '../types';

export const useMashupPreview = (shorts: IMashupShort[]) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup function
  const cleanup = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    audioRefs.current.forEach(audio => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    });
    audioRefs.current = [];
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Handle sequence playing
  const playSequence = useCallback(async () => {
    if (shorts.length === 0) return;
    cleanup();
    setIsPlaying(true);
    setCurrentIndex(0);

    // Initialize all audio elements
    shorts.forEach((short, idx) => {
      const audio = new Audio();
      audio.src = short.short.track?.trackUrl || '';
      audioRefs.current[idx] = audio;
    });

    let cumulativeDelay = 0;

    shorts.forEach((item, index) => {
      const audio = audioRefs.current[index];
      if (!audio) return;

      const startSec = (item.short.startTime > 10000) ? item.short.startTime / 1000 : item.short.startTime;
      const endSec = (item.short.endTime > 10000) ? item.short.endTime / 1000 : item.short.endTime;
      const durationSec = endSec - startSec;
      const transSec = item.transitionDuration / 1000;

      const timeoutId = setTimeout(() => {
        // Double check playing state
        // (React state closures might capture old state, we use refs in robust code, but for now this is ok if cleanup clears timeouts)
        
        setCurrentIndex(index);
        audio.currentTime = startSec || 0;
        audio.volume = 0;
        
        // Play and Fade In
        audio.play().then(() => {
          // Fade in over 1 second or transitionDuration
          let vol = 0;
          const fadeInterval = setInterval(() => {
            if (vol < 0.95) {
              vol += 0.05;
              audio.volume = vol;
            } else {
              audio.volume = 1;
              clearInterval(fadeInterval);
            }
          }, 50);
          timeoutsRef.current.push(fadeInterval as any);
        }).catch(err => {
          console.error("Preview play error:", err);
        });

        // Schedule Fade Out
        const fadeOutDelay = (durationSec - transSec) * 1000;
        const fadeOutTimeout = setTimeout(() => {
          let vol = 1;
          const fadeOutInterval = setInterval(() => {
            if (vol > 0.05) {
              vol -= 0.05;
              audio.volume = vol;
            } else {
              audio.pause();
              audio.volume = 0;
              clearInterval(fadeOutInterval);
              if (index === shorts.length - 1) {
                // End of sequence
                setIsPlaying(false);
                setCurrentIndex(-1);
              }
            }
          }, (transSec * 1000) / 20); // smoothly fade out over transSec
          timeoutsRef.current.push(fadeOutInterval as any);
        }, fadeOutDelay);
        
        timeoutsRef.current.push(fadeOutTimeout);

      }, cumulativeDelay * 1000);

      timeoutsRef.current.push(timeoutId);

      // Accumulate delay for the next track
      cumulativeDelay += (durationSec - transSec);
    });

  }, [shorts, cleanup]);

  const togglePlay = () => {
    if (isPlaying) {
      cleanup(); // Stop all
    } else {
      playSequence();
    }
  };

  return {
    isPlaying,
    currentIndex,
    togglePlay,
    stop: cleanup
  };
};
