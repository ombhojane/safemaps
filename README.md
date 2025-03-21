# SafeMaps Application

A React application that helps users find safe routes between locations.

## Features

- Google Places Autocomplete for location search
- Safe route planning and analysis
- Interactive maps with risk visualization

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or later)
- npm or yarn
- Google Places API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/safemaps.git
   cd safemaps
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

3. Set up environment variables
   
   Create a `.env` file in the root directory with the following content:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_google_places_api_key
   ```
   
   You can obtain a Google Places API key from the [Google Cloud Console](https://console.cloud.google.com/). Make sure to enable the Places API for your project.

4. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### Google Places API Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to APIs & Services > Library
4. Search for and enable the "Places API"
5. Go to APIs & Services > Credentials
6. Create an API key and restrict it to the Places API for security
7. Copy the API key to your `.env` file

## Usage

1. Enter your starting point and destination in the search form
2. The application will provide route options with safety analysis
3. Select a route to view detailed safety information and proceed with navigation

## Project info

**URL**: https://lovable.dev/projects/90e3a997-6998-458e-88fe-4b75cff8009a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/90e3a997-6998-458e-88fe-4b75cff8009a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/90e3a997-6998-458e-88fe-4b75cff8009a) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
