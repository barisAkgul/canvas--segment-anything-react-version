import { useState, useRef, useEffect, useCallback } from "react";

import "./ImageSegmenter.css";
import { useSegmentAnything } from "../../hooks/useSegmentAnything";

const BASE_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/";
const EXAMPLE_URL = `${BASE_URL}corgi.jpg`;

// Preload icons
const starIcon = new Image();
starIcon.src = `${BASE_URL}star-icon.png`;
starIcon.className = "icon";

const crossIcon = new Image();
crossIcon.src = `${BASE_URL}cross-icon.png`;
crossIcon.className = "icon";

interface Point {
  point: [number, number];
  label: number;
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = true
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(this, args);
  };
}

export default function ImageSegmenter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("");
  const [imageDataURI, setImageDataURI] = useState<string | null>(null);
  const [isMultiMaskMode, setIsMultiMaskMode] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isEncoded, setIsEncoded] = useState(false);
  const lastRequestRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { isReady, isProcessing, resetImage, segmentImage, decodePoints } =
    useSegmentAnything();

  useEffect(() => {
    if (imageDataURI === null) return;

    if (!isReady) {
      setStatus("Loading model...");
    } else if (isProcessing) {
      setStatus("Extracting image embedding...");
    } else if (imageDataURI) {
      setStatus("Ready for segmentation");
    } else {
      setStatus("Ready");
    }
  }, [isReady, isProcessing, imageDataURI]);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataURI = e.target?.result as string;
      await handleSegment(dataURI);
    };
    reader.readAsDataURL(file);
  };

  const handleExample = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleSegment(EXAMPLE_URL);
  };

  const handleSegment = async (dataURI: string) => {
    setImageDataURI(dataURI);
    setIsEncoded(false);
    setStatus("Processing image...");
    try {
      const response = await fetch(dataURI);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      await segmentImage(arrayBuffer);
      setIsEncoded(true);
      setStatus("Ready for segmentation");
    } catch (error) {
      setStatus("Error processing image");
    }
  };

  const addIcon = (point: Point) => {
    const icon = (
      point.label === 1 ? starIcon : crossIcon
    ).cloneNode() as HTMLImageElement;
    icon.style.left = `${point.point[0] * 100}%`;
    icon.style.top = `${point.point[1] * 100}%`;
    containerRef.current?.appendChild(icon);
  };

  const updateMask = useCallback((mask: any, scores: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = mask.width;
    canvas.height = mask.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const pixelData = imageData.data;

    let bestIndex = 0;
    for (let i = 1; i < scores.length; ++i) {
      if (scores[i] > scores[bestIndex]) {
        bestIndex = i;
      }
    }

    for (let i = 0; i < pixelData.length / 4; ++i) {
      if (mask.data[scores.length * i + bestIndex] === 1) {
        const offset = 4 * i;
        pixelData[offset] = 0; // red
        pixelData[offset + 1] = 114; // green
        pixelData[offset + 2] = 189; // blue
        pixelData[offset + 3] = 255; // alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setStatus(`Segment score: ${scores[bestIndex].toFixed(2)}`);
  }, []);

  const handleMouseMove = useCallback(
    debounce(
      async (e: React.MouseEvent) => {
        if (!isEncoded || isMultiMaskMode || isDecoding) return;

        // Cancel previous request if it's still pending
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        const point = getPointFromEvent(e);
        const requestId = Date.now();
        lastRequestRef.current = requestId;

        try {
          setIsDecoding(true);
          const result = await decodePoints([point]);

          // Only update if this is still the latest request
          if (
            requestId === lastRequestRef.current &&
            canvasRef.current &&
            result.mask
          ) {
            requestAnimationFrame(() => {
              updateMask(result.mask, result.scores);
            });
          }
        } catch (error: any) {
          if (error?.name !== "AbortError") {
            console.error("Error decoding points:", error);
          }
        } finally {
          if (requestId === lastRequestRef.current) {
            setIsDecoding(false);
          }
        }
      },
      16,
      true
    ), // 16ms debounce (approximately 60fps) and immediate=true
    [isEncoded, isMultiMaskMode, isDecoding, decodePoints, updateMask]
  );

  const handleMouseDown = useCallback(
    async (e: React.MouseEvent) => {
      if (!isEncoded || (e.button !== 0 && e.button !== 2)) return;

      if (!isMultiMaskMode) {
        setIsMultiMaskMode(true);
        setPoints([]);
      }

      const point = getPointFromEvent(e);
      const newPoints = [...points, point];
      setPoints(newPoints);
      addIcon(point);

      try {
        const result = await decodePoints(newPoints);
        if (canvasRef.current && result.mask) {
          requestAnimationFrame(() => {
            updateMask(result.mask, result.scores);
          });
        }
      } catch (error: any) {
        console.error("Error decoding points:", error);
      }
    },
    [isEncoded, isMultiMaskMode, points, decodePoints, updateMask]
  );

  const getPointFromEvent = (e: React.MouseEvent): Point => {
    const container = containerRef.current;
    if (!container) throw new Error("Container not found");

    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    return {
      point: [Math.max(Math.min(x, 1), 0), Math.max(Math.min(y, 1), 0)],
      label: e.button === 2 ? 0 : 1,
    };
  };

  const handleReset = () => {
    resetImage();
    setImageDataURI(null);
    setPoints([]);
    setIsMultiMaskMode(false);
    setIsEncoded(false);
    setStatus("Ready");
    // Remove all icons
    containerRef.current
      ?.querySelectorAll(".icon")
      .forEach((el) => el.remove());
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleClearPoints = () => {
    setPoints([]);
    setIsMultiMaskMode(false);
    // Remove all icons
    containerRef.current
      ?.querySelectorAll(".icon")
      .forEach((el) => el.remove());
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleCut = async () => {
    if (!canvasRef.current || !imageDataURI) return;

    const canvas = canvasRef.current;
    const [w, h] = [canvas.width, canvas.height];
    const maskCtx = canvas.getContext("2d");
    if (!maskCtx) return;

    const maskData = maskCtx.getImageData(0, 0, w, h);

    // Load the image
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = async () => {
      // Create temporary canvas for image
      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = w;
      imageCanvas.height = h;
      const imageCtx = imageCanvas.getContext("2d");
      if (!imageCtx) return;

      imageCtx.drawImage(image, 0, 0, w, h);
      const imageData = imageCtx.getImageData(0, 0, w, h);

      // Create temporary canvas for cut-out
      const cutCanvas = document.createElement("canvas");
      cutCanvas.width = w;
      cutCanvas.height = h;
      const cutCtx = cutCanvas.getContext("2d");
      if (!cutCtx) return;

      const cutData = cutCtx.createImageData(w, h);

      // Copy masked pixels
      for (let i = 3; i < maskData.data.length; i += 4) {
        if (maskData.data[i] > 0) {
          for (let j = 0; j < 4; ++j) {
            const offset = i - j;
            cutData.data[offset] = imageData.data[offset];
          }
        }
      }
      cutCtx.putImageData(cutData, 0, 0);

      // Download image
      const link = document.createElement("a");
      link.download = "cut-image.png";
      link.href = cutCanvas.toDataURL("image/png");
      link.click();
      link.remove();
    };
    image.src = imageDataURI;
  };

  return (
    <div className="segmenter-container">
      <h1>Segment Anything w/ 🤗 Transformers.js</h1>

      <div
        ref={containerRef}
        className="container"
        style={{
          backgroundImage: imageDataURI ? `url(${imageDataURI})` : "none",
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!imageDataURI && (
          <div className="upload-button" onClick={handleUpload}>
            <svg
              width="25"
              height="25"
              viewBox="0 0 25 25"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#000"
                d="M3.5 24.3a3 3 0 0 1-1.9-.8c-.5-.5-.8-1.2-.8-1.9V2.9c0-.7.3-1.3.8-1.9.6-.5 1.2-.7 2-.7h18.6c.7 0 1.3.2 1.9.7.5.6.7 1.2.7 2v18.6c0 .7-.2 1.4-.7 1.9a3 3 0 0 1-2 .8H3.6Zm0-2.7h18.7V2.9H3.5v18.7Zm2.7-2.7h13.3c.3 0 .5 0 .6-.3v-.7l-3.7-5a.6.6 0 0 0-.6-.2c-.2 0-.4 0-.5.3l-3.5 4.6-2.4-3.3a.6.6 0 0 0-.6-.3c-.2 0-.4.1-.5.3l-2.7 3.6c-.1.2-.2.4 0 .7.1.2.3.3.6.3Z"
              />
            </svg>
            Click to upload image
            <span
              className="example"
              onClick={handleExample}
              onMouseDown={(e) => e.stopPropagation()}
            >
              (or try example)
            </span>
          </div>
        )}
        <canvas ref={canvasRef} className="mask-output" />
      </div>

      <div className="status">{status}</div>

      <div className="controls">
        <button onClick={handleReset}>Reset image</button>
        <button onClick={handleClearPoints}>Clear points</button>
        <button onClick={handleCut} disabled={!imageDataURI || !points.length}>
          Cut mask
        </button>
      </div>

      <p className="information">
        Left click = positive points, right click = negative points.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
