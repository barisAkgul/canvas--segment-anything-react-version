import { useEffect, useRef, useState } from "react";

interface Point {
  point: [number, number];
  label: number;
}

interface SegmentResult {
  mask: any;
  scores: number[];
}

export const useSegmentAnything = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../services/segmentWorker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;

      switch (type) {
        case "ready":
          setIsReady(true);
          break;
        case "segment_result":
          if (data === "start") {
            setIsProcessing(true);
          } else if (data === "done") {
            setIsProcessing(false);
          }
          break;
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const resetImage = () => {
    workerRef.current?.postMessage({ type: "reset" });
  };

  const segmentImage = async (imageData: ArrayBuffer) => {
    return new Promise<void>((resolve, reject) => {
      if (!workerRef.current) return reject("Worker not initialized");

      const handleMessage = (e: MessageEvent) => {
        const { type, data } = e.data;
        if (type === "segment_result" && data === "done") {
          workerRef.current?.removeEventListener("message", handleMessage);
          resolve();
        }
      };

      workerRef.current.addEventListener("message", handleMessage);
      workerRef.current.postMessage({ type: "segment", data: imageData });
    });
  };

  const decodePoints = async (points: Point[]): Promise<SegmentResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) return reject("Worker not initialized");

      const handleMessage = (e: MessageEvent) => {
        const { type, data } = e.data;
        if (type === "decode_result") {
          workerRef.current?.removeEventListener("message", handleMessage);
          resolve(data);
        }
      };

      workerRef.current.addEventListener("message", handleMessage);
      workerRef.current.postMessage({ type: "decode", data: points });
    });
  };

  return {
    isReady,
    isProcessing,
    resetImage,
    segmentImage,
    decodePoints,
  };
};
