import { useState, useEffect, useRef } from "react";
import { searchApi } from "@/features/search";
import { useRoomMutations } from "./useRoomMutations";
import { SearchTrack } from "@/features/search/types";
import { useDebounce } from "@/hooks/useDebounce";
import { APP_CONFIG } from "@/config/constants";

export const useRoomAddTrack = (roomCode: string) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    const fetchResults = async () => {
      setIsSearching(true);
      try {
        const data = await searchApi.search({ q: debouncedQuery, limit: APP_CONFIG.PAGINATION_LIMIT });
        setResults(data.tracks || []);
        setIsOpen(true);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    };
    fetchResults();
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { addToQueueAsync, isAddingToQueue } = useRoomMutations();

  const handleAdd = async (trackId: string, isListener?: boolean, onRequest?: (trackId: string) => void) => {
    try {
      if (isListener && onRequest) {
        onRequest(trackId);
        setQuery("");
        setIsOpen(false);
        return;
      }
      
      await addToQueueAsync({ roomCode, trackId });
      setQuery("");
      setIsOpen(false);
    } catch (error: any) {
      // Error is handled by useRoomMutations
    }
  };

  return {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    containerRef,
    handleAdd,
    isAddingToQueue,
  };
};
