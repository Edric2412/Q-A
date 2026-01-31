"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import styles

interface MathRendererProps {
    content: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content }) => {
    return (
        <div className="math-content">
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Override paragraph to avoid hydration errors or unwanted margins if needed
                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
