# Radio Canada Font Setup Instructions

## 1. Download Radio Canada Font
Download the Radio Canada font family from Google Fonts:
- Visit https://fonts.google.com/specimen/Radio+Canada
- Download the font files

## 2. Create Font Directory
Create the following directory structure:
```
d:\native\fypApp\assets\fonts\
```

## 3. Add Font Files
Place these font files in the assets/fonts directory:
- RadioCanada-Light.otf (300 weight)
- RadioCanada-Regular.otf (400 weight) 
- RadioCanada-Medium.otf (500 weight)
- RadioCanada-SemiBold.otf (600 weight)
- RadioCanada-Bold.otf (700 weight)

## 4. Update Metro Configuration
Add this to your `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the assets folder to the asset resolver
config.resolver.assetExts.push(
  // Add font extensions
  'otf',
  'ttf',
  'woff',
  'woff2'
);

module.exports = config;
```

## 5. Update package.json
Add this to your package.json:

```json
{
  "expo": {
    "font": [
      "./assets/fonts/RadioCanada-Light.otf",
      "./assets/fonts/RadioCanada-Regular.otf",
      "./assets/fonts/RadioCanada-Medium.otf",
      "./assets/fonts/RadioCanada-SemiBold.otf",
      "./assets/fonts/RadioCanada-Bold.otf"
    ]
  }
}
```

## 6. Install Expo Font
```bash
npm install expo-font
```

## 7. Update App.tsx
The App.tsx has been updated to use the CustomText component with Radio Canada font.

## 8. Usage
Use the CustomText component throughout your app:

```tsx
import CustomText from '../components/CustomText';

// Different font weights
<CustomText weight={300}>Light text</CustomText>
<CustomText weight={400}>Regular text</CustomText>
<CustomText weight={500}>Medium text</CustomText>
<CustomText weight={600}>SemiBold text</CustomText>
<CustomText weight={700}>Bold text</CustomText>
```

## 9. Clean and Rebuild
```bash
npx expo start --clear
```

The LoginScreen has been updated to use Radio Canada font throughout. All other screens should also use the CustomText component for consistent typography.
