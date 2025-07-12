import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App'; // ต้อง import จาก App.tsx

test('renders PetCare App title', () => {
  render(<App />);
  const titleElement = screen.getByText(/PetCare/i); // ค้นหาข้อความ PetCare
  expect(titleElement).toBeInTheDocument();
});