# ResiPlan AI - Floor Plan Generator

![ResiPlan AI](https://img.shields.io/badge/Status-Active-brightgreen) ![Tech Stack](https://img.shields.io/badge/Stack-MERN-blue) ![HuggingFace](https://img.shields.io/badge/AI-FLUX.1--schnell-orange)

ResiPlan AI is a cutting-edge web application built on the MERN stack that instantly generates both pixel-perfect **2D Blueprint / CAD drawings** and breathtaking **Photorealistic 3D architectural floor plans** based on user-defined parameters.

---

## 🎨 Features

- **Dual Rendering Engines**: 
  - **CAD Mode (2D Sketch / Blueprint)**: A programmatic server-side layout algorithm returns structured geometry rendered beautifully on the client via HTML5 Canvas. Perfect for precise dimensions, geometric blueprints, scaling, and architectural mockups.
  - **3D Render Mode**: Employs prompt engineering with **HuggingFace (`black-forest-labs/FLUX.1-schnell`)** to generate high-end, top-down orthographic 3D cutaways with miniature scaled furniture, wall thicknesses, and soft V-Ray ambient lighting.
- **Smart Room Logic**: Dynamically calculates precise room area breakdowns based on customizable square footage, ensuring that the final output makes architectural sense.
- **Vastu Shastra Integration**: Incorporates traditional Indian architecture rules, orienting key rooms (Kitchen, living room, master bedroom) based on the user's selected Main Entry direction.
- **Auto-Validation**: The AI incorporates an automated validation checking loop on generated 3D images using the **Salesforce BLIP** (Image Captioning) model to prevent multi-story generation and strictly enforce single-floor boundaries.
- **Export Capabilities**: Instantly download both 2D canvas blueprints and 3D outputs as PNG/JPEG files locally.

---

## 🛠️ Technology Stack

| Layer | Tools & Frameworks |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS, React Router, HTML5 Canvas |
| **Backend** | Node.js, Express, Mongoose |
| **Database** | MongoDB Atlas |
| **AI / Machine Learning** | HuggingFace Inference API, FLUX.1-schnell, Pollinations.ai API, Salesforce BLIP |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs |

---

## 📂 Project Structure

### `/client` (Frontend)
- `src/components/CADFloorPlanRenderer.jsx`: The core engine for programmatic HTML5 Canvas 2D blueprint rendering. It draws accurately scaled exterior/interior walls, entry arrows, dimension rulers, and specific outlined furniture (beds, sofas, tables).
- `src/components/FloorPlanViewer.jsx`: A measurement overlay wrapper that projects dynamic X/Y axis rulers and an Entry Gate badge on top of the AI-generated 3D image.
- `src/pages/Dashboard.jsx`: The main user interface consisting of form-based configurations (sqFt, room counts, outdoor features, Vastu compliance) and the dynamic visual preview panel.
- `src/context/AuthContext.jsx` & `ThemeContext.jsx`: Global state providers for authentication flow and Dark/Light Mode toggling.

### `/server` (Backend)
- `server.js`: The central monolithic API dealing with input processing, Vastu logic mapping, dynamic prompting, API orchestration with HuggingFace, and fallback mechanisms for image generation scenarios. Also includes algorithmic spatial distribution (`computeCADLayout`) which bypasses AI logic completely for strict CAD mockups.
- `routes/auth.js`: Handles user registration and login functionality using bcrypt implementation and local JWT signing.
- `models/User.js`: Schema definition for MongoDB interactions.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster URL
- HuggingFace API Token (for 3D generation capabilities)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YashG504/AI_Floor_Plan_Generartor.git
cd AI_Floor_Plan_Generartor
```

2. Set up the backend (Server):
```bash
cd server
npm install
```
Create a `.env` file in the `/server` directory:
```env
PORT=5002
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
HF_API_KEY=your_huggingface_api_token
```

3. Set up the frontend (Client):
```bash
cd ../client
npm install
```
Create a `.env` file in the `/client` directory:
```env
VITE_API_URL=http://localhost:5002
```

4. Run the project locally:
Open two terminal instances.
- **Server**: `npm run dev` (starts on port 5002)
- **Client**: `npm run start` (starts Vite dev server)

---

## 💡 How The Algorithm Works

When you request a **Sketch or Blueprint**:
Our server evaluates the requested room permutations and creates a proportional area map (e.g., bedrooms taking the left half, living areas taking the right with exterior outdoor features correctly mapped outside the main structural array). It routes coordinates to the React frontend, which meticulously loops through the instructions using context API and strokes the specific objects onto an HTML5 Canvas component.

When you request a **Photorealistic 3D plan**:
The app skips the Canvas logic completely, processes your form constraints into a colossal architectural prompt, and sends it to the AI. Specific commands structure "INDOOR ROOMS" mapping and "OUTDOOR AREAS" explicitly to stop the AI from rendering gardens *inside* the house boundaries. The resulting cutaway render is served to the dashboard along with a smart sqft layout breakdown block.

---

## 👩‍💻 Contributors
Developed for modern architectural visualizations. Feel free to submit PRs and issues.
