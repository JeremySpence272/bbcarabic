// should to two things
// 1. translate the arabic text to english
// 2. add diacritics to the arabic text
// should be able to send in a batch of episodes or a single episode. each episode will have a title and description
// if batch, should make the openai calls in batches of 3
// handle batch logic in this library

import { RawPodcast, Podcast } from "@/types/types";

interface TranslateResponse {
  title_english: string;    
  description_english: string;
  title_arabic: string;
  description_arabic: string;
  mp3_url: string;
  published: string;
  duration_seconds: string;
  audio_type: string;
  id: string;
}

// takes in arabic text and returns english text
export async function translateToEnglish(episodes: RawPodcast[]): Promise<Podcast[]> {
  // make the openai call
  const response = await fetch(`/api/openai/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ episodes }),
  });
  const data: TranslateResponse[] = await response.json();
  const diacritics = await addDiacritics(data);

  const podcasts = data.map((episode, index) => ({
    ...episode,
    title_arabic_diacritics: diacritics[index].diacriticTitle,
    description_arabic_diacritics: diacritics[index].diacriticDescription,
  }));
  return podcasts;
  
}

interface DiacriticsResponse {
  diacriticTitle: string;
  diacriticDescription: string;
}


// takes in arabic text and returns arabic text with diacritics
export async function addDiacritics(episodes: TranslateResponse[]): Promise<DiacriticsResponse[]> {
    const textToProcess = episodes.map((episode) => ({
        title: episode.title_arabic,
        description: episode.description_arabic,
    }));
    const response = await fetch(`/api/openai/diacritics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ textToProcess }),
    });
    const data = await response.json();

    return data.episodes;
}