import { useState, useCallback } from "react";
import { IMashupShort, calcMashupDuration, MASHUP_MAX_DURATION } from "../types";
import { ITrackShort } from "@/features/shorts/types";

export const useMashupBuilder = () => {
  const [shorts, setShorts] = useState<IMashupShort[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  /** Total duration of current mashup (seconds) */
  const totalDuration = calcMashupDuration(shorts);
  const remainingTime = Math.max(0, MASHUP_MAX_DURATION - totalDuration);

  const addShort = useCallback((short: ITrackShort) => {
    setShorts(prev => {
      const start = short.startTime ?? 0;
      const end   = short.endTime   ?? 0;
      const dur   = Math.max(0, end - start);

      // Check if adding this short would exceed max duration
      const currentTotal = calcMashupDuration(prev);
      if (currentTotal + dur > MASHUP_MAX_DURATION) return prev;

      const newShort: IMashupShort = {
        short,
        order: prev.length,
        transitionType: 'crossfade',
        transitionDuration: 2000,
        volume: 1,
      };
      return [...prev, newShort];
    });
  }, []);

  const removeShort = useCallback((index: number) => {
    setShorts(prev => {
      const newArr = [...prev];
      newArr.splice(index, 1);
      return newArr.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const reorderShorts = useCallback((startIndex: number, endIndex: number) => {
    setShorts(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const updateTransition = useCallback(
    (index: number, type: IMashupShort['transitionType'], duration: number) => {
      setShorts(prev => {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], transitionType: type, transitionDuration: duration };
        return newArr;
      });
    },
    [],
  );

  const updateVolume = useCallback((index: number, volume: number) => {
    setShorts(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], volume: Math.max(0, Math.min(1, volume)) };
      return newArr;
    });
  }, []);

  const updateTrim = useCallback((index: number, trimStart: number, trimEnd: number) => {
    setShorts(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], trimStart, trimEnd };
      return newArr;
    });
  }, []);

  return {
    shorts,
    setShorts,
    title,
    setTitle,
    description,
    setDescription,
    totalDuration,
    remainingTime,
    addShort,
    removeShort,
    reorderShorts,
    updateTransition,
    updateVolume,
    updateTrim,
  };
};
