// utils/formMapper.ts
import {
  GenreCreateFormValues,
  GenreEditFormValues,
} from "../schemas/genre.schema";
import { IGenre } from "../types";

export type GenreFormValues = GenreCreateFormValues | GenreEditFormValues;

export const GENRE_DEFAULT_VALUES: GenreCreateFormValues = {
  name: "",
  description: "",
  color: "#1db954", // match schema default
  gradient: "",
  parentId: undefined,
  image: undefined,
  priority: 0,
  isTrending: false,
};

export const mapEntityToForm = (genre?: IGenre | null): GenreFormValues => {
  if (!genre) return GENRE_DEFAULT_VALUES;

  return {
    name: genre.name,
    description: genre.description ?? "",
    color: genre.color ?? "#1db954",
    gradient: genre.gradient ?? "",
    image: genre.image ?? undefined,
    parentId:
      typeof genre.parentId === "object"
        ? (genre.parentId?._id ?? "root")
        : (genre.parentId ?? "root"),
    priority: genre.priority ?? 0,
    isTrending: genre.isTrending ?? false,
  };
};
