import { useEffect } from 'react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export const startTour = () => {
 const driverObj = driver({
 showProgress: true,
 steps: [
 {
 element: '#tour-tabs-container',
 popover: { title: 'Navigation', description: 'Switch between different tools and your content library here.' }
 },
 {
 element: '#tour-generator-form',
 popover: { title: 'Generate Content', description: 'Fill in these details to generate your customized CBC materials.' }
 }
 ]
 });
 driverObj.drive();
};

export const GuidedTourOverlay = () => {
 useEffect(() => {
 if (!localStorage.getItem('exameno_guided_tour_done')) {
 const timer = setTimeout(() => {
 startTour();
 localStorage.setItem('exameno_guided_tour_done', 'true');
 }, 1000); 
 return () => clearTimeout(timer);
 }
 }, []);

 return null;
};
