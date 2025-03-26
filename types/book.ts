export interface Book {
    title: string;
    link: string;
    date: string;
    author: string;
    category: z.enum(["Fiction", "Non-Fiction", "Manga", 'Comics & Graphic Novels', 'Philosophy']).optional(),
    tags: z.array(z.string()).optional(),
    cover_image: z.string().optional(),
}