# Segment Anything with React & Transformers.js

This project is a React application that runs Meta's Segment Anything Model (SAM) in the web browser. It operates entirely on the client-side using Transformers.js, without requiring any server.

## 🌟 Features

- 🖼️ Image upload and sample image usage
- 🎯 Real-time segment analysis
- 🖱️ Instant segment detection with mouse hover
- ⭐ Positive/negative point marking
- ✂️ Cut and download selected segments
- 🚀 High-performance processing
- 💻 Completely browser-based operation

With this application, you can:

- Automatically detect objects in any image
- Perform instant object detection by moving the mouse over the image
- Precisely select desired objects
- Extract and save selected objects from the background

## ⚡ Key Features

- 🎯 **Real-Time Detection**: Objects are instantly detected as you move the mouse
- 🖱️ **Precise Selection**:
  - Left click: Select object
  - Right click: Refine selection
- 💾 **Easy Export**: Save selected objects as PNG
- 🚀 **Browser-Based**: No server required, runs entirely in the browser

## 🚀 Getting Started

1. **Clone the Project**

```bash
git clone [repo-url]
cd [project-name]
```

2. **Install Dependencies**

```bash
npm install
```

3. **Start Development Server**

```bash
npm run dev
```

4. **Open in Browser**

```
http://localhost:5173
```

## 💡 How to Use

1. **Load an Image**

   - Click "Upload Image" button
   - Or choose from sample images

2. **Object Detection**

   - Move mouse over the image
   - Objects are automatically highlighted

3. **Precise Selection**

   - Left click: Mark points on objects you want to select
   - Right click: Mark points on areas you want to exclude
   - Add multiple points for increased precision

4. **Cut and Save**
   - Click "Cut Selection" button
   - Download as PNG

## ⚠️ Important Notes

- Model file (approximately 50MB) will be downloaded on first launch
- Performance may decrease with large images (over 4096x4096)
- Modern browser recommended (Chrome, Firefox, Edge)

## 🔧 Troubleshooting

**Slow Performance:**

- Use smaller images
- Update your browser
- Close other tabs

**Image Won't Load:**

- Use supported formats (PNG, JPEG, WebP)
- Use local images for CORS issues

## 🔑 Key Points

1. **Model Loading**

   - Model downloads on first load
   - Subsequent uses load from cache
   - Approximately 50MB model size

2. **Image Processing**

   - Maximum 4096x4096 pixels recommended
   - CORS-enabled images required
   - PNG, JPEG, WebP formats supported

3. **Browser Support**
   - Modern browsers supported
   - Web Workers API required
   - WebGL support recommended

## 🐛 Known Issues and Solutions

1. **Slowdown with Large Images**

   - **Issue**: Performance drop with images over 4096x4096
   - **Solution**: Resize image before loading
   - **Workaround**: Use smaller images

2. **Safari Performance Issues**

   - **Issue**: Delays in WebWorker communication on Safari
   - **Solution**: Safari-optimized worker pool
   - **Workaround**: Use Chrome or Firefox

3. **Mobile Touch Support**

   - **Issue**: Reduced precision in touch events
   - **Solution**: Touch-specific event handling (in development)
   - **Workaround**: Use mouse/trackpad

4. **Memory Leaks**

   - **Issue**: Memory increase during extended use
   - **Solution**: Automatic garbage collection and cleanup
   - **Workaround**: Periodically refresh the page

5. **CORS Issues**
   - **Issue**: Access blocked to some images
   - **Solution**: Use CORS-enabled resources
   - **Workaround**: Download and use images locally

## 🛠️ Technologies Used

- React 18+
- TypeScript 5+
- @xenova/transformers: ^2.14.0
- Vite 5+

## 📁 Project Structure

```
src/
├── components/
│   └── ImageSegmenter/
│       ├── ImageSegmenter.tsx    # Main segment component
│       └── ImageSegmenter.css    # Component styles
├── services/
│   └── segmentWorker.ts         # Web Worker service
├── hooks/
│   └── useSegmentAnything.ts    # Custom hook for segment operations
├── assets/                      # Static files
├── App.tsx                      # Main application component
├── App.css                      # Main stylesheet
├── main.tsx                     # Application entry point
├── index.css                    # Global styles
└── vite-env.d.ts               # TypeScript type definitions
```
