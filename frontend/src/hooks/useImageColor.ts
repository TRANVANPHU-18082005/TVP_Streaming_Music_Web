import { useState, useEffect } from "react";

/**
 * Extracts the dominant color from an image URL using a hidden Canvas.
 * Returns the hex color and a boolean indicating if the color is considered light.
 */
export function useImageColor(imageUrl?: string) {
  const [color, setColor] = useState<string>("");
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale down for faster processing
      canvas.width = Math.min(img.width, 100);
      canvas.height = Math.min(img.height, 100);
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0;
        
        // Sample every 4th pixel for performance
        const step = 4 * 4; 
        let count = 0;
        
        for (let i = 0; i < data.length; i += step) {
          // Ignore transparent pixels
          if (data[i + 3] === 0) continue;
          
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        
        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          setColor(hex);
          
          // Calculate relative luminance
          // using standard formula: 0.2126*R + 0.7152*G + 0.0722*B
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          setIsLight(luminance > 0.6);
        }
      } catch (e) {
        // Fallback for CORS errors
        console.warn("Could not extract image color due to CORS");
      }
    };

    img.src = imageUrl;
  }, [imageUrl]);

  return { color, isLight };
}
