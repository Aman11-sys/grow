const controllers = angular.module('osControllers', []);

// Quick JSON prompt helper
const jsonPromptHelper = `You MUST return ONLY valid JSON. NEVER include markdown formatting like \`\`\`json or \`\`\`. Start directly with { or [ and end with } or ].`;

controllers.controller('OnboardingCtrl', ['$scope', 'AIService', 'DBService', 'UnsplashService', '$rootScope', '$location', function ($scope, AIService, DBService, UnsplashService, $rootScope, $location) {
  $scope.formData = {};
  $scope.loading = false;
  $scope.result = null;
  $scope.error = null;
  $scope.dbError = null;
  $scope.businessImage = null;

  $scope.submitForm = async function () {
    $scope.loading = true;
    $scope.error = null;
    $scope.dbError = null;
    $scope.result = null;

    const prompt = `Act as an expert business analyst. Here are details about a business:
    Name: ${$scope.formData.name || 'N/A'}
    Website: ${$scope.formData.website || 'N/A'}
    Type: ${$scope.formData.type || 'N/A'}
    Target Audience: ${$scope.formData.audience || 'N/A'}
    City: ${$scope.formData.city || 'N/A'}
    Products/Services: ${$scope.formData.products || 'N/A'}
    
    Generate a concise AI business profile.
    ${jsonPromptHelper}
    Return exactly this structure: { "name": "...", "industry": "...", "usp": "...", "targetPersona": "...", "toneOfVoice": "..." }`;

    try {
      // 1. Generate AI Content first
      const aiData = await AIService.generateContent(prompt, 'profile');
      const imageQuery = $scope.formData.type || "business office";
      const imageUrl = await UnsplashService.getImage(imageQuery);

      $scope.$apply(() => {
        $scope.result = aiData;
        $scope.businessImage = imageUrl;
        $scope.loading = false;
        $rootScope.businessProfile = aiData;
      });

      // 2. Try to save to DB (Don't let DB failure block the UI result)
      try {
        await DBService.saveData('profiles', { 
          ...$scope.formData, 
          ai_profile: aiData,
          image: imageUrl 
        });
      } catch (dbErr) {
        $scope.$apply(() => {
          $scope.dbError = "Profile generated but failed to save to database. Check if MySQL is running.";
        });
      }
    } catch (e) {
      $scope.$apply(() => {
        $scope.error = "AI Generation failed. Check your Gemini API Key in .env.local";
        $scope.loading = false;
      });
    }
  };

  $scope.continueToCalendar = function () {
    $location.path('/calendar');
  };
}]);

controllers.controller('CalendarCtrl', ['$scope', 'AIService', 'DBService', '$rootScope', function ($scope, AIService, DBService, $rootScope) {
  $scope.calendar = [];
  $scope.loading = false;
  $scope.error = null;
  $scope.dbError = null;

  $scope.generateCalendar = async function () {
    if (!$rootScope.businessProfile) {
      $scope.error = "Please complete onboarding first.";
      return;
    }

    $scope.loading = true;
    $scope.error = null;
    $scope.dbError = null;

    const profile = $rootScope.businessProfile;
    const prompt = `Create a 7-day social media content plan for: ${profile.name} (Industry: ${profile.industry}, USP: ${profile.usp}, Tone: ${profile.toneOfVoice}). 
    Include festival awareness for upcoming 30 days if relevant.
    ${jsonPromptHelper}
    Return an array of objects: [{ "day": number, "platform": "string", "theme": "string", "pillar": "string", "time": "string", "festival": "string" }]`;

    try {
      const data = await AIService.generateContent(prompt, 'calendar');
      $scope.$apply(() => {
        $scope.calendar = Array.isArray(data) ? data : (data.days || []);
        $scope.loading = false;
      });

      try {
        await DBService.saveData('calendars', { profileName: profile.name, plan: $scope.calendar });
      } catch (dbErr) {
        $scope.$apply(() => {
          $scope.dbError = "Calendar generated but failed to save to database.";
        });
      }
    } catch (e) {
      $scope.$apply(() => {
        $scope.error = "Generation failed. Try again.";
        $scope.loading = false;
      });
    }
  };
}]);

controllers.controller('CaptionsCtrl', ['$scope', 'AIService', 'DBService', 'UnsplashService', '$rootScope', function ($scope, AIService, DBService, UnsplashService, $rootScope) {
  $scope.productDesc = "";
  $scope.captions = [];
  $scope.loading = false;
  $scope.error = null;
  $scope.dbError = null;
  $scope.copied = -1;
  $scope.productImage = null;

  $scope.generateCaptions = async function () {
    if (!$scope.productDesc) {
      $scope.error = "Please enter a product description.";
      return;
    }

    $scope.loading = true;
    $scope.error = null;
    $scope.dbError = null;
    $scope.captions = [];
    $scope.productImage = null;

    const tone = $rootScope.businessProfile ? $rootScope.businessProfile.toneOfVoice : "Professional and engaging";

    const prompt = `Generate 3 variation captions with hashtags and a Call-To-Action for the following product/service:
    "${$scope.productDesc}"
    Brand Tone: ${tone}
    ${jsonPromptHelper}
    Return an array of strings like: ["caption 1", "caption 2", "caption 3"]`;

    try {
      const data = await AIService.generateContent(prompt, 'captions');
      const imageUrl = await UnsplashService.getImage("product " + $scope.productDesc.split(" ").slice(0, 4).join(" "));
      $scope.$apply(() => {
        $scope.captions = Array.isArray(data) ? data : [data];
        $scope.productImage = imageUrl;
        $scope.loading = false;
      });

      try {
        await DBService.saveData('captions', { desc: $scope.productDesc, captions: $scope.captions, image: imageUrl });
      } catch (dbErr) {
        $scope.$apply(() => {
          $scope.dbError = "Captions generated but failed to save to database.";
        });
      }
    } catch (e) {
      $scope.$apply(() => {
        $scope.error = "Failed to generate captions.";
        $scope.loading = false;
      });
    }
  };

  $scope.copyToClipboard = function (text, index) {
    navigator.clipboard.writeText(text).then(() => {
      $scope.$apply(() => {
        $scope.copied = index;
      });
      setTimeout(() => {
        $scope.$apply(() => {
          $scope.copied = -1;
        });
      }, 2000);
    });
  };
}]);

controllers.controller('FestivalsCtrl', ['$scope', 'AIService', 'DBService', '$rootScope', function ($scope, AIService, DBService, $rootScope) {
  $scope.festivals = [
    { date: "April 10, 2026", name: "Diwali", description: "Festival of lights" },
    { date: "April 14, 2026", name: "Ambedkar Jayanti", description: "Birth anniversary of B. R. Ambedkar" },
    { date: "May 1, 2026", name: "Labour Day", description: "International Workers' Day" },
    { date: "May 10, 2026", name: "Mother's Day", description: "Celebration honoring mothers" }
  ];

  $scope.activeIdea = null;
  $scope.loadingIdeaFor = null;
  $scope.dbError = null;

  $scope.generateIdea = async function (fest) {
    $scope.loadingIdeaFor = fest.name;
    $scope.activeIdea = null;
    $scope.dbError = null;

    const ind = $rootScope.businessProfile ? $rootScope.businessProfile.industry : "General Business";
    const prompt = `Suggest a creative 2-sentence social media campaign idea for a business in the '${ind}' industry for the occasion of '${fest.name}'.`;

    try {
      const resp = await AIService.generateContent(prompt, 'idea');
      const ideaText = typeof resp === 'string' ? resp : (resp.idea || JSON.stringify(resp));
      $scope.$apply(() => {
        $scope.activeIdea = { festival: fest.name, text: ideaText };
        $scope.loadingIdeaFor = null;
      });

      try {
        await DBService.saveData('ideas', {
          festivalName: fest.name,
          industry: ind,
          idea: ideaText
        });
      } catch (dbErr) {
        $scope.$apply(() => {
          $scope.dbError = "Idea generated but failed to save to database.";
        });
      }
    } catch (e) {
      $scope.$apply(() => {
        $scope.loadingIdeaFor = null;
        alert("Failed to generate idea.");
      });
    }
  };
}]);

import Chart from 'chart.js/auto';

controllers.controller('DashboardCtrl', ['$scope', 'AIService', 'DBService', '$timeout', function ($scope, AIService, DBService, $timeout) {
  $scope.loading = false;
  $scope.insight = null;
  $scope.dbError = null;

  const mockMetrics = {
    ctr: 3.4,
    cpc: 12.5,
    roas: 2.1,
    conversion: 1.8
  };

  $scope.metrics = mockMetrics;

  $scope.generateInsight = async function () {
    $scope.loading = true;
    $scope.dbError = null;
    const prompt = `Analyze this mock ad performance data: CTR=${mockMetrics.ctr}%, CPC=${mockMetrics.cpc}, ROAS=${mockMetrics.roas}, Conversion Rate=${mockMetrics.conversion}%. 
    Provide a 2-sentence AI insight identifying what's working and what to optimize.`;

    try {
      const resp = await AIService.generateContent(prompt, 'insight');
      const text = typeof resp === 'string' ? resp : (resp.insight || JSON.stringify(resp));
      $scope.$apply(() => {
        $scope.insight = text;
        $scope.loading = false;
      });

      try {
        await DBService.saveData('insights', {
          metrics: mockMetrics,
          insight: text
        });
      } catch (dbErr) {
        $scope.$apply(() => {
          $scope.dbError = "Insight generated but failed to save to database.";
        });
      }
    } catch (e) {
      $scope.$apply(() => {
        $scope.loading = false;
        alert("Failed to provide insight.");
      });
    }
  };

  $timeout(() => {
    const ctxBar = document.getElementById('barChart');
    if (ctxBar) {
      new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [{
            label: 'Clicks',
            data: [120, 190, 150, 220],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    const ctxLine = document.getElementById('lineChart');
    if (ctxLine) {
      new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Conversions',
            data: [2, 5, 3, 8, 4, 9, 6],
            borderColor: 'rgba(139, 92, 246, 1)',
            tension: 0.3
          }]
        },
        options: { responsive: true }
      });
    }
  }, 100);
}]);


