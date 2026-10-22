/** Order of the hero chapters. Kept free of client-only imports so server components can use it. */
export const CHAPTER_SLUGS = ['cyrus', 'nova', 'mira', 'zest', 'flova'] as const;
export const CHAPTER_COUNT = CHAPTER_SLUGS.length;
