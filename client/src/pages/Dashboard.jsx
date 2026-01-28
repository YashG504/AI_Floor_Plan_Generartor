import { useState, useContext } from 'react';
import { Home, Bath, Layers, Box, TreeDeciduous, Palmtree, Flower2, Monitor, School, Building2, Warehouse, Sun, Moon } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import ThemeContext from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [length, setLength] = useState(40);
  const [breadth, setBreadth] = useState(45);
  // sqFeet is derived
  const sqFeet = length * breadth;

  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [floors, setFloors] = useState(1);
  const [layoutType, setLayoutType] = useState('Open Concept');
  const [archStyle, setArchStyle] = useState('Modern');
  const [renderStyle, setRenderStyle] = useState('Photorealistic 3D');
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedLayout, setGeneratedLayout] = useState(null);
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
        details: {
          bedrooms,
          bathrooms,
          sqFeet,
          layoutType,
          archStyle,
          features: selectedFeatures
        }
      });

      setGeneratedImage(response.data.image);
      setGeneratedLayout(response.data.layout_breakdown);
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans p-6 transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="text-center w-full relative">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center gap-3">
            <Home className="text-blue-500" /> ResiPlan AI
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Design your dream home with AI-powered architectural sketches</p>

          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-yellow-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleLogout} className="text-sm bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 shadow-sm transition">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Controls Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
              <Box className="w-5 h-5 text-blue-500 dark:text-blue-400" /> House Parameters
            </h3>

            {/* Core Specs */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Core Specs</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Home size={12} /> Bedrooms</label>
                  <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Bath size={12} /> Bathrooms</label>
                  <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Layers size={12} /> Floors</label>
                  <input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>
            </div>

            {/* Size & Layout */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Size & Layout</h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Length (ft)</label>
                  <input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Breadth (ft)</label>
                  <input type="number" value={breadth} onChange={(e) => setBreadth(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>
              <div className="flex justify-between text-xs mb-4 px-1">
                <span className="text-slate-500 dark:text-slate-300">Total Area</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{sqFeet} sq ft</span>
              </div>

              <div className="mb-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Layout Type</label>
                <select value={layoutType} onChange={(e) => setLayoutType(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition">
                  <option>Open Concept</option>
                  <option>Traditional</option>
                  <option>Studio</option>
                </select>
              </div>
            </div>

            {/* Style & Render */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Style & Render</h4>
              <div className="mb-4">
                <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Architectural Style</label>
                <select value={archStyle} onChange={(e) => setArchStyle(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition">
                  <option>Modern</option>
                  <option>Contemporary</option>
                  <option>Minimalist</option>
                  <option>Industrial</option>
                </select>
              </div>
              <div className="mb-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Render Style</label>
                <select value={renderStyle} onChange={(e) => setRenderStyle(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition">
                  <option>Photorealistic 3D</option>
                  <option>Blueprint</option>
                  <option>Sketch</option>
                </select>
              </div>
            </div>

            {/* Rooms & Features */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Rooms & Features</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.keys(features).map((key) => (
                  <label key={key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={features[key]}
                      onChange={() => handleFeatureChange(key)}
                      className="rounded border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                    />
                    <span className="text-slate-700 dark:text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerateFloorPlan}
              disabled={generationInProgress}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${generationInProgress
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/20'
                }`}
            >
              {generationInProgress ? 'Generating...' : 'Generate Floor Plan'}
            </button>

            <div className="text-right mt-4 text-xs text-slate-500 flex items-center justify-end gap-1">
              <span className="text-yellow-500">✨</span> {generatedImage ? 'Floor plan generated successfully!' : 'Ready to generate'}
            </div>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 h-full min-h-[600px] flex items-center justify-center relative shadow-sm">

            {/* Error State */}
            {errorMessage && (
              <div className="text-center p-10">
                <p className="text-red-500 dark:text-red-400 text-lg font-semibold">Generation Failed</p>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">{errorMessage}</p>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-sm transition-colors text-slate-800 dark:text-slate-200"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Loading State */}
            {generationInProgress && !errorMessage && (
              <div className="text-center p-10">
                <div className="mb-4 text-blue-500 dark:text-blue-400 inline-block p-4 rounded-full bg-slate-100 dark:bg-slate-800 animate-spin">
                  <Home size={48} />
                </div>
                <p className="text-blue-600 dark:text-blue-400 text-lg font-semibold">Generating floor plan...</p>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">This may take 30-60 seconds depending on API load</p>
              </div>
            )}

            {/* Generated Image */}
            {generatedImage && !generationInProgress && !errorMessage && (
              <div className="flex flex-col items-center w-full h-full p-4">
                <img
                  src={generatedImage}
                  alt="Generated Floor Plan"
                  className="max-w-full max-h-[60vh] object-contain mb-16 rounded shadow-lg border border-slate-200 dark:border-slate-700"
                />

                {/* Generated Breakdown */}
                {generatedLayout && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800/80 p-4 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
                    <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Layers size={14} /> Room Breakdown
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {generatedLayout.map((room, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-700/50 p-2 rounded text-xs flex justify-between items-center border border-slate-200 dark:border-slate-600">
                          <span className="text-slate-800 dark:text-slate-200">{room.name}</span>
                          <div className="text-right">
                            <div className="text-blue-600 dark:text-blue-300 font-mono">{room.dimensions}</div>
                            <div className="text-slate-500 dark:text-slate-500 text-[10px]">{room.area} sqft</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Initial State */}
            {!generationInProgress && !generatedImage && !errorMessage && (
              <div className="text-center p-10">
                <div className="mb-4 text-slate-400 dark:text-slate-600 inline-block p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                  <Home size={48} />
                </div>
                <p className="text-slate-500 dark:text-slate-500 text-lg">Your AI-generated floor plan will appear here</p>
                <p className="text-slate-600 dark:text-slate-600 text-sm mt-2">Adjust parameters on the left and click Generate</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
