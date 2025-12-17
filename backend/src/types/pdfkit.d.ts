declare module 'pdfkit' {
    import { Stream } from 'stream';
    
    interface PDFDocumentOptions {
        margin?: number;
        size?: string | [number, number];
        layout?: 'portrait' | 'landscape';
        info?: {
            Title?: string;
            Author?: string;
            Subject?: string;
            Keywords?: string;
        };
    }
    
    class PDFDocument extends Stream {
        constructor(options?: PDFDocumentOptions);
        pipe(destination: any): this;
        text(text: string, x?: number, y?: number, options?: any): this;
        fontSize(size: number): this;
        moveDown(count?: number): this;
        end(): void;
    }
    
    export = PDFDocument;
}

