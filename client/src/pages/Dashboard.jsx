import { useState, useContext } from 'react';
import { Home, Bath, Layers, Box, TreeDeciduous, Palmtree, Flower2, Monitor, School, Building2, Warehouse, Sun, Moon, Compass, MessageSquare, Send, Download } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import ThemeContext from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import FloorPlanViewer from '../components/FloorPlanViewer';
import CADFloorPlanRenderer from '../components/CADFloorPlanRenderer';

const MAX_DIMENSION_FT = 500;

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
  const [layoutType] = useState('Open Concept');
  const [archStyle] = useState('Normal');
  const [renderStyle, setRenderStyle] = useState('Photorealistic 3D');
  const [entryDirection, setEntryDirection] = useState('East');
  const [vastuCompliant, setVastuCompliant] = useState(false);
  const [selectedModel, setSelectedModel] = useState('flux');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Hi! I can help you modify the plan. Powered by Stability Diffusion Model. Try "add a garage" or "change to south facing".' }
  ]);
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedLayout, setGeneratedLayout] = useState(null);
  const [cadLayout, setCadLayout] = useState(null);       // ← CAD mode data
  const [renderMode, setRenderMode] = useState(null);     // 'cad' | '3d'
  const [roomDirections, setRoomDirections] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);

  const [features, setFeatures] = useState({
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
    if (!Number.isFinite(length) || !Number.isFinite(breadth) || length <= 0 || breadth <= 0) {
      setErrorMessage('Invalid input: Length and breadth must be greater than 0 ft.');
      return;
    }

    if (length > MAX_DIMENSION_FT || breadth > MAX_DIMENSION_FT) {
      setErrorMessage(`Invalid input: Length and breadth must be ${MAX_DIMENSION_FT} ft or less.`);
      return;
    }

    if (bedrooms <= 0 || bathrooms < 0) {
      setErrorMessage('Invalid input: Please enter valid room counts.');
      return;
    }

    if (bedrooms > 6) {
      setErrorMessage('Maximum 6 bedrooms supported for 2D layout generation.');
      return;
    }

    if (bedrooms > 5 || bathrooms > 5 || sqFeet > 2500) {
      setErrorMessage('Input exceeds allowed limits. Please update your data.');
      return;
    }
    
    setGenerationInProgress(true);
    setErrorMessage(null);
    setGeneratedImage(null);
    setCadLayout(null);
    setRenderMode(null);

    const selectedFeatures = Object.entries(features)
      .filter(([_, selected]) => selected)
      .map(([name]) => name)
      .join(', ');

    try {
      const response = await api.post('/generate-floorplan', {
        model: selectedModel,
        details: { bedrooms, bathrooms, sqFeet, length, breadth, layoutType, archStyle, renderStyle, features: selectedFeatures, entryDirection, vastuCompliant, roomDirections }
      });
      if (response.data.renderMode === 'cad') {
        // Add a short delay for sketch output so the generation feels substantial
        await new Promise(resolve => setTimeout(resolve, 4500));
        setRenderMode('cad');
        setCadLayout(response.data.cadLayout);
        setGeneratedImage(null);
      } else {
        setRenderMode(response.data.renderMode);
        setGeneratedImage(response.data.image);
        setCadLayout(null);
      }
      setGeneratedLayout(response.data.layout_breakdown);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Failed to generate floor plan. Please try again.');
    } finally {
      setGenerationInProgress(false);
    }
  };

  const handleDownload = () => {
    if (renderMode === 'cad') {
      // CADFloorPlanRenderer has its own download button; this is a fallback
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `floor-plan-${renderStyle.toLowerCase()}.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } else {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = 'floor-plan-3d.jpg';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const input = chatInput.toLowerCase();
    const newHistory = [...chatHistory, { role: 'user', text: chatInput }];
    let response = "I've updated the plan based on your request. Click 'Generate' to see changes.";

    if (input.includes('bedroom')) {
      const num = input.match(/\d+/);
      if (num) setBedrooms(parseInt(num[0]));
      else if (input.includes('add')) setBedrooms(b => b + 1);
      else if (input.includes('remove')) setBedrooms(b => Math.max(1, b - 1));
    }
    if (input.includes('bathroom')) {
      const num = input.match(/\d+/);
      if (num) setBathrooms(parseInt(num[0]));
      else if (input.includes('add')) setBathrooms(b => b + 1);
    }
    if (input.includes('garage')) setFeatures(f => ({ ...f, garage: !input.includes('remove') }));
    if (input.includes('pool')) setFeatures(f => ({ ...f, pool: !input.includes('remove') }));
    if (input.includes('garden')) setFeatures(f => ({ ...f, garden: !input.includes('remove') }));
    if (input.includes('office')) setFeatures(f => ({ ...f, office: !input.includes('remove') }));
    if (input.includes('balcony')) setFeatures(f => ({ ...f, balcony: !input.includes('remove') }));
    if (input.includes('vastu')) {
      setVastuCompliant(!input.includes('remove') && !input.includes('no'));
      response = input.includes('no') ? 'Vastu mode disabled.' : 'Vastu mode enabled.';
    }
    
    // Direction mapping for supported entry directions
    const dirMap = {
      'east': 'East', 'west': 'West', 'north': 'North'
    };

    for (const [key, val] of Object.entries(dirMap)) {
      if (input.includes(key)) {
        setEntryDirection(val);
        break;
      }
    }

    setChatHistory([...newHistory, { role: 'ai', text: response }]);
    setChatInput('');

    if (input.includes('generate') || input.includes('update') || input.includes('show')) handleGenerateFloorPlan();
  };

  return (
    <div className="min-h-screen bg-[#f5f5dc] dark:bg-slate-900 text-slate-900 dark:text-white font-sans p-6 transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="text-center w-full relative">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center gap-3">
            <Home className="text-blue-500" /> ResiPlan AI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Design your dream home with AI-powered architectural sketches</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Powered by Stability Diffusion Model</p>

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
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
              <Box className="w-5 h-5 text-blue-500 dark:text-blue-400" /> House Parameters
            </h3>

            {/* Core Specs */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Core Specs</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Home size={12} /> Bedrooms</label>
                  <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Bath size={12} /> Bathrooms</label>
                  <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>
            </div>

            {/* Size & Layout */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Size & Layout</h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Length (ft)</label>
                  <input type="number" min="1" max={MAX_DIMENSION_FT} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Breadth (ft)</label>
                  <input type="number" min="1" max={MAX_DIMENSION_FT} value={breadth} onChange={(e) => setBreadth(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>
              <div className="flex justify-between text-xs mb-4 px-1">
                <span className="text-slate-500 dark:text-slate-300">Total Area</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{sqFeet} sq ft</span>
              </div>
            </div>

            {/* Entry & Vastu */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Orientation & Vastu</h4>
              <div className="mb-3">
                <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1"><Compass size={12} /> Main Entry Facing</label>
                <select value={entryDirection} onChange={(e) => setEntryDirection(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition">
                  <option>East</option>
                  <option>West</option>
                  <option>North</option>
                </select>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={vastuCompliant} onChange={() => setVastuCompliant(!vastuCompliant)} className="rounded border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-blue-500 focus:ring-blue-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Enable Vastu Compliance</span>
              </label>
            </div>

            {/* Render Style */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Render Style</h4>
              <div className="mb-4">
                <select value={renderStyle} onChange={(e) => setRenderStyle(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition">
                  <option>Photorealistic 3D</option>
                  <option>Blueprint</option>
                  <option>Sketch</option>
                </select>
              </div>
            </div>

            {/* Room Directions */}
            <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3">Room Face Directions</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  'Living Room', 'Kitchen',
                  ...Array.from({ length: bedrooms }, (_, i) => `Bedroom ${i + 1}`),
                  ...Array.from({ length: bathrooms }, (_, i) => `Bathroom ${i + 1}`),
                  ...(features.diningRoom ? ['Dining Room'] : []),
                  ...(features.office ? ['Office'] : [])
                ].map(room => (
                  <div key={room}>
                    <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">{room}</label>
                    <select
                      value={roomDirections[room] || 'Auto'}
                      onChange={(e) => setRoomDirections({ ...roomDirections, [room]: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition"
                    >
                      <option value="Auto">Auto</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="North-East">North-East</option>
                      <option value="North-West">North-West</option>
                      <option value="South-East">South-East</option>
                      <option value="South-West">South-West</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Rooms & Features */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg mb-6">
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


            {/* Chatbot Interface */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 mb-6">
              <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2"><MessageSquare size={14} /> AI Assistant</h4>
              <div className="h-40 overflow-y-auto mb-3 p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`p-2 rounded ${msg.role === 'ai' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-4'}`}>
                    <strong>{msg.role === 'ai' ? 'AI' : 'You'}:</strong> {msg.text}
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type updates (e.g. 'add a pool')..."
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                />
                <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition"><Send size={14} /></button>
              </form>
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
              <span className="text-yellow-500">✨</span> {(generatedImage || cadLayout) ? 'Floor plan generated successfully!' : 'Ready to generate'}
            </div>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="lg:col-span-9">
          <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 h-full min-h-[600px] flex items-center justify-center relative shadow-sm">

            {/* Compass & Vastu Indicator */}
            <div className="absolute top-5 right-5 z-10 flex flex-col items-center gap-2">
              {/* Compass Rose */}
              <div className="relative w-20 h-20 bg-white dark:bg-slate-700 rounded-full border-2 border-blue-300 dark:border-blue-500 shadow-lg flex items-center justify-center">
                {/* East, West & North Directions */}
                {['N', 'E', 'W'].map((dir) => {
                  const angles = { 
                    N: 'top-1 left-1/2 -translate-x-1/2',
                    E: 'right-1 top-1/2 -translate-y-1/2', 
                    W: 'left-1 top-1/2 -translate-y-1/2',
                  };
                  const dirMap = { N: 'North', E: 'East', W: 'West' };
                  const isSelected = entryDirection === dirMap[dir];
                  return (
                    <span key={dir} className={`absolute text-[10px] sm:text-[11px] font-bold ${angles[dir]} ${isSelected ? 'text-blue-500 dark:text-blue-400 scale-125' : 'text-slate-500 dark:text-slate-400'}`}>
                      {dir}
                    </span>
                  );
                })}
                {/* Center dot */}
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                {/* Arrow pointing to entry direction */}
                <div className={`absolute w-0.5 h-6 bg-red-500 rounded-full origin-bottom ${
                  entryDirection === 'East' ? 'bottom-1/2 left-1/2 -translate-x-1/2 rotate-90' :
                  entryDirection === 'West' ? 'bottom-1/2 left-1/2 -translate-x-1/2 -rotate-90' :
                  'bottom-1/2 left-1/2 -translate-x-1/2' // North
                  }`} />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{entryDirection} Entry</p>
              {vastuCompliant && (
                <div className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-full px-2 py-0.5 font-semibold">
                  ✓ Vastu
                </div>
              )}
            </div>

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

            {/* ── CAD Floor Plan (Sketch / Blueprint mode) ── */}
            {renderMode === 'cad' && cadLayout && !generationInProgress && !errorMessage && (
              <div className="flex flex-col items-center justify-center w-full p-4 gap-4">
                <CADFloorPlanRenderer
                  cadLayout={cadLayout}
                  length={length}
                  breadth={breadth}
                  entryDirection={entryDirection}
                  renderStyle={renderStyle}
                />
                {/* Room Breakdown */}
                {generatedLayout && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800/80 p-4 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[400px] overflow-y-auto">
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

            {/* ── 3D AI Generated Image ── */}
            {renderMode === '3d' && generatedImage && !generationInProgress && !errorMessage && (
              <div className="flex flex-col items-center justify-center w-full p-4 gap-4">
                <FloorPlanViewer
                  imageSrc={generatedImage}
                  length={length}
                  breadth={breadth}
                  entryDirection={entryDirection}
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

                {/* Download Button */}
                <div className="w-full flex justify-end mt-2">
                  <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-sm transition-colors text-slate-800 dark:text-slate-200">
                    <Download size={16} /> Download {renderStyle === 'Sketch' ? 'Sketch' : '3D'} JPG
                  </button>
                </div>
              </div>
            )}

            {/* Initial State */}
            {!generationInProgress && !generatedImage && !cadLayout && !errorMessage && (
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
