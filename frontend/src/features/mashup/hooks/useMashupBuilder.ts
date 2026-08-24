import { useState, useCallback } from "react";
import { IMashupShort } from "../types";
import { ITrackShort } from "@/features/shorts/types";

export const useMashupBuilder = () => {
  const [shorts, setShorts] = useState<IMashupShort[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const addShort = useCallback((short: ITrackShort) => {
    setShorts(prev => {
      // Giới hạn max 8 shorts
      if (prev.length >= 8) return prev;
      
      const newShort: IMashupShort = {
        short,
        order: prev.length,
        transitionType: 'crossfade',
        transitionDuration: 2000
      };
      return [...prev, newShort];
    });
  }, []);

  const removeShort = useCallback((index: number) => {
    setShorts(prev => {
      const newArr = [...prev];
      newArr.splice(index, 1);
      // Cập nhật lại order
      return newArr.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const reorderShorts = useCallback((startIndex: number, endIndex: number) => {
    setShorts(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Cập nhật lại order
      return result.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const updateTransition = useCallback((index: number, type: 'crossfade' | 'cut' | 'beatmatch', duration: number) => {
    setShorts(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], transitionType: type, transitionDuration: duration };
      return newArr;
    });
  }, []);

  return {
    shorts,
    title,
    setTitle,
    description,
    setDescription,
    addShort,
    removeShort,
    reorderShorts,
    updateTransition,
    setShorts
  };
};
