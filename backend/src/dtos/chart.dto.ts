export interface IArtistMin {
  _id: string;
  name: string;
  avatar: string;
  slug?: string;
}

export interface IAlbumMin {
  _id: string;
  title: string;
  slug: string;
}

export interface IChartItem {
  _id: string;
  title: string;
  slug: string;
  duration: number;
  coverImage: string;
  hlsUrl?: string;
  playCount: number;
  score: number;
  artist: IArtistMin;
  album?: IAlbumMin;
  featuringArtists: IArtistMin[];
}

export interface IChartPoint {
  time: string;
  top1: number;
  top2: number;
  top3: number;
}

export interface IRealtimeChartResponse {
  items: IChartItem[];
  chart: IChartPoint[];
}
