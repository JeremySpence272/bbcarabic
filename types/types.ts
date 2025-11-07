export interface Podcast {
    id: string;
    title_arabic: string;
    title_english: string;
    description_arabic: string;
    description_english: string;
    title_arabic_diacritics: string;
    description_arabic_diacritics: string;
    mp3_url: string;
    published: string;
    duration_seconds: string;
    audio_type: string;
}

export interface RawPodcast {
    id: string;
    title_arabic: string;
    description_arabic: string;
    mp3_url: string;
    published: string;
    duration_seconds: string;
    audio_type: string;
}