import './services.js';
import './controllers.js';

const app = angular.module('osApp', [
  'ngRoute',
  'osServices',
  'osControllers'
]);

app.controller('RootCtrl', ['$scope', function($scope) {
  $scope.isDarkMode = false;
  $scope.toggleTheme = function() {
    $scope.isDarkMode = !$scope.isDarkMode;
  };
}]);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/onboarding', {
      templateUrl: 'src/views/onboarding.html',
      controller: 'OnboardingCtrl'
    })
    .when('/calendar', {
      templateUrl: 'src/views/calendar.html',
      controller: 'CalendarCtrl'
    })
    .when('/captions', {
      templateUrl: 'src/views/captions.html',
      controller: 'CaptionsCtrl'
    })
    .when('/festivals', {
      templateUrl: 'src/views/festivals.html',
      controller: 'FestivalsCtrl'
    })
    .when('/dashboard', {
      templateUrl: 'src/views/dashboard.html',
      controller: 'DashboardCtrl'
    })
    .otherwise({
      redirectTo: '/onboarding'
    });
}]);
