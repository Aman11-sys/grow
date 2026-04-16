import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const services = angular.module('osServices', []);

// Backend API Setup
const API_URL = import.meta.env.VITE_API_URL || 'https://grow-production-c594.up.railway.app/api';

// AI Providers Setup
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || "";

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true }) : null;

services.factory('AIService', ['$q', function($q) {
  return {
    generateContent: async function(prompt, type = 'general') {
      try {
        const response = await fetch(`${API_URL}/ai/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, type })
        });
        
        if (!response.ok) {
           const err = await response.json();
           throw new Error(err.message || "AI Generation Failed");
        }
        
        return await response.json();
      } catch (err) {
        console.error("AI Service Error:", err);
        // Fallback for safety if backend is down
        if (type === 'profile') {
          return { name: "Mock Business (Backend Down)", industry: "Error Recovery", usp: "Check backend connectivity", targetPersona: "Unknown", toneOfVoice: "Neutral" };
        }
        throw err;
      }
    }
  };
}]);

services.factory('DBService', ['$q', function($q) {
  return {
    saveData: async function(collectionName, data) {
      try {
        const response = await fetch(`${API_URL}/${collectionName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Server Error Details:', errorData);
          throw new Error(`Failed to save to MySQL: ${errorData.message || 'Unknown Error'}`);
        }
        return await response.json();
      } catch (e) {
        console.error("Error saving to MySQL: ", e);
        throw e;
      }
    },
    getData: async function(collectionName) {
      try {
        const response = await fetch(`${API_URL}/${collectionName}`);
        if (!response.ok) throw new Error('Failed to fetch from MySQL');
        return await response.json();
      } catch(e) {
        console.error("Error reading from MySQL: ", e);
        throw e;
      }
    }
  };
}]);

services.factory('UnsplashService', ['$q', function($q) {
  const unsplashKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  
  return {
    getImage: async function(query) {
      if (!unsplashKey) {
        // Fallback placeholder image if no key is provided
        return `https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`;
      }
      try {
        const res = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&orientation=landscape`);
        const data = await res.json();
        return data.urls.regular;
      } catch (e) {
        console.warn("Unsplash API failed, using fallback.");
        return `https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`;
      }
    }
  };
}]);
