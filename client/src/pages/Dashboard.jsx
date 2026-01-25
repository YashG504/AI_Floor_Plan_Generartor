import { useState, useContext } from 'react';
import { Home, Bath, Layers, Box, TreeDeciduous, Palmtree, Flower2, Monitor, School, Building2, Warehouse } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [sqFeet, setSqFeet] = useState(1800);
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [floors, setFloors] = useState(1);
  const [layoutType, setLayoutType] = useState('Open Concept');
  const [archStyle, setArchStyle] = useState('Modern');
  const [renderStyle, setRenderStyle] = useState('Photorealistic 3D');
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // UI State for checkboxes
  const [features, setFeatures] = useState({
    kitchen: true,
    livingRoom: true,
    diningRoom: true,
    office: false,
    garage: false,
    balcony: false,
    garden: false,
    pool: false
  });

  const handleFeatureChange = (feature) => {
    setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGenerateFloorPlan = async () => {
    setGenerationInProgress(true);
    setErrorMessage(null);
    setGeneratedImage(null);

    // Build prompt from parameters
    const selectedFeatures = Object.entries(features)
      .filter(([_, selected]) => selected)
      .map(([name, _]) => name)
      .join(', ');

    const prompt = `top-down 3D floor plan, ${bedrooms} bedrooms, ${bathrooms} bathrooms, ${sqFeet} sq ft, ${layoutType} layout, ${archStyle} style, ${renderStyle}, with ${selectedFeatures}, white background, clear room labels`;

    try {
      const response = await api.post('/generate-floorplan', {
        prompt: prompt,
      });

      setGeneratedImage(response.data.image);
    } catch (error) {
      console.error('Error generating floor plan:', error);
      setErrorMessage(
        error.response?.data?.error || 
        'Failed to generate floor plan. Please try again.'
      );
    } finally {
      setGenerationInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="text-center w-full relative">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center gap-3">
            <Home className="text-blue-500" /> AI FloorPlan Generator
          </h1>
          <p className="text-slate-400 mt-2">Design your dream home with AI-powered architectural sketches</p>
          {/* User Profile & Logout - Absolute positioned to be cornered or just flexed if simpler */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
            <button onClick={handleLogout} className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded border border-slate-700">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Controls Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Box className="w-5 h-5 text-blue-400" /> House Parameters
            </h3>

            {/* Core Specs */}
            <div className="mb-6 p-4 border border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-3">Core Specs</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1 flex items-center gap-1"><Home size={12} /> Bedrooms</label>
                  <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1 flex items-center gap-1"><Bath size={12} /> Bathrooms</label>
                  <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1 flex items-center gap-1"><Layers size={12} /> Floors</label>
                  <input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            {/* Size & Layout */}
            <div className="mb-6 p-4 border border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-3">Size & Layout</h4>

              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Square Feet</span>
                  <span className="text-blue-400 font-bold">{sqFeet} sq ft</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  value={sqFeet}
                  onChange={(e) => setSqFeet(e.target.value)}
                  className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="mb-1">
                <label className="text-xs text-slate-300 block mb-1">Layout Type</label>
                <select value={layoutType} onChange={(e) => setLayoutType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-200">
                  <option>Open Concept</option>
                  <option>Traditional</option>
                  <option>Studio</option>
                </select>
              </div>
            </div>

            {/* Style & Render */}
            <div className="mb-6 p-4 border border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-3">Style & Render</h4>
              <div className="mb-4">
                <label className="text-xs text-slate-300 block mb-1">Architectural Style</label>
                <select value={archStyle} onChange={(e) => setArchStyle(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-200">
                  <option>Modern</option>
                  <option>Contemporary</option>
                  <option>Minimalist</option>
                  <option>Industrial</option>
                </select>
              </div>
              <div className="mb-1">
                <label className="text-xs text-slate-300 block mb-1">Render Style</label>
                <select value={renderStyle} onChange={(e) => setRenderStyle(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-200">
                  <option>Photorealistic 3D</option>
                  <option>Blueprint</option>
                  <option>Sketch</option>
                </select>
              </div>
            </div>

            {/* Rooms & Features */}
            <div className="p-4 border border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-3">Rooms & Features</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.kitchen} onChange={() => handleFeatureChange('kitchen')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Kitchen</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.livingRoom} onChange={() => handleFeatureChange('livingRoom')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Living Room</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.diningRoom} onChange={() => handleFeatureChange('diningRoom')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Dining Room</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.office} onChange={() => handleFeatureChange('office')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Office</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.garage} onChange={() => handleFeatureChange('garage')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Garage</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.balcony} onChange={() => handleFeatureChange('balcony')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Balcony</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.garden} onChange={() => handleFeatureChange('garden')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Garden</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={features.pool} onChange={() => handleFeatureChange('pool')} className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-slate-300">Pool</span>
                </label>
              </div>
            </div>

            <button onClick={handleGenerateFloorPlan} disabled={generationInProgress} className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200">
              {generationInProgress ? 'Generating...' : 'Generate Floor Plan'}
            </button>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="lg:col-span-8">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            <div className="flex-grow rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 flex items-center justify-center relative overflow-hidden group">
              {/* Error Message */}
              {errorMessage && (
                <div className="text-center p-10">
                  <div className="mb-4 text-red-400 inline-block p-4 rounded-full bg-slate-800">
                    <Home size={48} />
                  </div>
                  <p className="text-red-400 text-lg font-semibold">Generation Failed</p>
                  <p className="text-slate-400 text-sm mt-2">{errorMessage}</p>
                </div>
              )}
              
              {/* Loading State */}
              {generationInProgress && !errorMessage && (
                <div className="text-center p-10">
                  <div className="mb-4 text-blue-400 inline-block p-4 rounded-full bg-slate-800 animate-spin">
                    <Home size={48} />
                  </div>
                  <p className="text-blue-400 text-lg font-semibold">Generating floor plan...</p>
                  <p className="text-slate-400 text-sm mt-2">This may take 30-60 seconds depending on API load</p>
                </div>
              )}
              
              {/* Generated Image */}
              {generatedImage && !generationInProgress && !errorMessage && (
                <img
                  src={generatedImage}
                  alt="Generated Floor Plan"
                  className="max-w-full max-h-full object-contain"
                />
              )}
              
              {/* Initial State */}
              {!generationInProgress && !generatedImage && !errorMessage && (
                <div className="text-center p-10">
                  <div className="mb-4 text-slate-600 inline-block p-4 rounded-full bg-slate-800">
                    <Home size={48} />
                  </div>
                  <p className="text-slate-500 text-lg">Your AI-generated floor plan will appear here</p>
                  <p className="text-slate-600 text-sm mt-2">Adjust parameters on the left and click Generate</p>
                </div>
              )}

              {/* Overlay simulation */}
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-0 transition duration-500">
                <p className="text-white font-medium">Preview Area</p>
              </div>
            </div>
            <div className="text-right mt-4 text-xs text-slate-500 flex items-center justify-end gap-1">
              <span className="text-yellow-500">✨</span> {generatedImage ? 'Floor plan generated successfully!' : 'Ready to generate'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
