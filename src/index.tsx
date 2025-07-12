import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // ตรวจสอบให้แน่ใจว่า import App จากไฟล์ App.tsx ของคุณ
import reportWebVitals from './reportWebVitals'; // อาจจะมีหรือไม่มีก็ได้

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element with ID 'root'.");
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(); // อาจจะมีหรือไม่มีก็ได้