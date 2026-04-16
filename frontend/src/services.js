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
      // Prioritize OpenAI if key is present
      if (openai) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
          });
          
          let text = response.choices[0].message.content;
          
          // Clean markdown from AI response if it exists
          if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0].trim();
          } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0].trim();
          }

          try {
            return JSON.parse(text);
          } catch(e) {
            return text;
          }
        } catch (err) {
          console.error("OpenAI API Error", err);
          throw new Error("OpenAI Generation failed. Check your API key.");
        }
      }

      // Fallback to Gemini
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        try {
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          if (text.includes("```json")) {
             const jsonStr = text.split("```json")[1].split("```")[0].trim();
             return JSON.parse(jsonStr);
          }
          
          try {
             return JSON.parse(text);
          } catch(e) {
             return text;
          }
        } catch (e) {
          console.error("Gemini API Error", e);
          throw new Error("AI Generation failed. Check your API key.");
        }
      }

      // Mock Fallback
      console.warn("No AI API Keys found. Returning mock response.");
      return new Promise(resolve => {
        setTimeout(() => {
          if (type === 'profile') {
            resolve({
              name: "Mock Business",
              industry: "E-commerce",
              usp: "Fast and reliable mock products",
              targetPersona: "Mock Users aged 18-35",
              toneOfVoice: "Playful"
            });
          } else if (type === 'calendar') {
             resolve([{ day: 1, platform: "Instagram", theme: "Welcome", pillar: "Brand", time: "9AM", festival: "None" }]);
          } else if (type === 'captions') {
             resolve(["Captivating caption 1", "Engaging caption 2", "Trendy caption 3"]);
          } else {
            resolve("This is a mock AI response because no API keys were configured.");
          }
        }, 1000);
      });
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
