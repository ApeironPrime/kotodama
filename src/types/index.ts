export interface VocabularyWord {
    id: string;
    word: string;
    reading: string;
    meaning: string;
    level: string;
    jlpt: string;
}

export interface Course {
    id: string;
    title: string;
    description: string;
    level: string;
    progress: number;
}

export interface VideoLesson {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    level: string;
}