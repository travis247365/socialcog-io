import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Plus,
  Wifi,
  WifiOff,
  X,
  Trash2,
} from "lucide-react";
import "./App.css";

const SocialNetworkMapper = () => {
  // State management
  const canvasRef = useRef(null);
  const [profiles, setProfiles] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState(null);

  // New profile form
  const [newProfile, setNewProfile] = useState({
    username: "",
    platform: "twitter",
  });

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3002");

    ws.onopen = () => {
      console.log("✅ Connected to WebSocket server");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "profiles_update":
          setProfiles(data.profiles);
          break;
        case "connections_update":
          setConnections(data.connections);
          break;
        case "profile_added":
          console.log("New profile added:", data.profile);
          break;
        default:
          console.log("Unknown WebSocket message:", data.type);
      }
    };

    ws.onclose = () => {
      console.log("❌ Disconnected from WebSocket server");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    fetchProfiles();
    fetchConnections();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/profiles");
      const data = await response.json();
      setProfiles(data);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/connections");
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  };

  // Update nodes when profiles change
  useEffect(() => {
    if (profiles.length > 0) {
      updateNodes();
    }
  }, [profiles]);

  const updateNodes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.6;

    const newNodes = profiles.map((profile, index) => {
      const angle = (index / profiles.length) * 2 * Math.PI;
      return {
        id: profile.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        radius: Math.max(20, Math.min(40, profile.followers / 1000)),
        profile: profile,
        vx: 0,
        vy: 0,
      };
    });

    setNodes(newNodes);
  }, [profiles]);

  // Canvas drawing
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw connections
    connections.forEach((connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source_id);
      const targetNode = nodes.find((n) => n.id === connection.target_id);

      if (sourceNode && targetNode) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = `rgba(100, 149, 237, ${
          connection.connection_strength * 0.6
        })`;
        ctx.lineWidth = Math.max(1, connection.connection_strength * 3);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      const { profile } = node;

      // Platform colors
      const colors = {
        twitter: "#1DA1F2",
        linkedin: "#0077B5",
        github: "#333333",
        instagram: "#E4405F",
        facebook: "#4267B2",
      };

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = colors[profile.platform] || "#6366F1";
      ctx.fill();

      // Border
      ctx.strokeStyle = selectedProfile?.id === node.id ? "#F59E0B" : "#ffffff";
      ctx.lineWidth = selectedProfile?.id === node.id ? 3 : 2;
      ctx.stroke();

      // Username label
      ctx.fillStyle = "#000000";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      const text =
        profile.username.length > 12
          ? profile.username.substring(0, 12) + "..."
          : profile.username;
      ctx.fillText(text, node.x, node.y + node.radius + 15);
    });

    ctx.restore();
  }, [nodes, connections, selectedProfile, pan, zoom]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawCanvas();
      requestAnimationFrame(animate);
    };
    animate();
  }, [drawCanvas]);

  // Canvas event handlers
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;

    // Check if clicked on a node
    const clickedNode = nodes.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    if (clickedNode) {
      setSelectedProfile(clickedNode.profile);
    } else {
      setSelectedProfile(null);
    }
  };

  const handleCanvasMouseDown = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;

    const draggedNode = nodes.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    if (draggedNode) {
      setIsDragging(true);
      setDragNode(draggedNode);
    }
  };

  const handleCanvasMouseMove = (event) => {
    if (isDragging && dragNode) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - pan.x) / zoom;
      const y = (event.clientY - rect.top - pan.y) / zoom;

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === dragNode.id ? { ...node, x, y } : node
        )
      );
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDragNode(null);
  };

  // Add profile function
  const addProfile = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });

      if (response.ok) {
        const profile = await response.json();
        console.log("Profile added:", profile);
        setNewProfile({ username: "", platform: "twitter" });
        setShowAddModal(false);
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error("Error adding profile:", error);
      alert("Failed to add profile");
    }
  };

  // Delete profile function
  const deleteProfile = async (profileId) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/profiles/${profileId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setSelectedProfile(null);
      }
    } catch (error) {
      console.error("Error deleting profile:", error);
    }
  };

  // Filter profiles
  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch = profile.username
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPlatform =
      filterPlatform === "all" || profile.platform === filterPlatform;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <Users className="logo-icon" />
          <h1>Social Network Mapper</h1>
          <div
            className={`connection-status ${
              isConnected ? "connected" : "disconnected"
            }`}
          >
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        <div className="header-controls">
          <button className="btn primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Profile
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="search-section">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="platform-filter"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="all">All Platforms</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="github">GitHub</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <div className="profiles-list">
            <h3>Profiles ({filteredProfiles.length})</h3>
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className={`profile-item ${
                  selectedProfile?.id === profile.id ? "selected" : ""
                }`}
                onClick={() => setSelectedProfile(profile)}
              >
                <div className={`platform-indicator ${profile.platform}`}></div>
                <div className="profile-info">
                  <div className="username">@{profile.username}</div>
                  <div className="platform">{profile.platform}</div>
                  <div className="stats">
                    {profile.followers.toLocaleString()} followers
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-area">
          <div className="canvas-controls">
            <button onClick={() => setZoom(zoom * 1.2)}>
              <ZoomIn size={16} />
            </button>
            <button onClick={() => setZoom(zoom * 0.8)}>
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          />
        </div>

        {/* Profile Details */}
        {selectedProfile && (
          <div className="profile-details">
            <div className="profile-header">
              <h3>@{selectedProfile.username}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedProfile(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="profile-stats">
              <div className="stat">
                <div className="stat-value">
                  {selectedProfile.followers.toLocaleString()}
                </div>
                <div className="stat-label">Followers</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {selectedProfile.following.toLocaleString()}
                </div>
                <div className="stat-label">Following</div>
              </div>
              <div className="stat">
                <div className="stat-value">{selectedProfile.posts}</div>
                <div className="stat-label">Posts</div>
              </div>
            </div>

            <div className="profile-info-section">
              <div className="info-item">
                <strong>Platform:</strong> {selectedProfile.platform}
              </div>
              <div className="info-item">
                <strong>Engagement:</strong>{" "}
                {(selectedProfile.engagement_rate * 100).toFixed(1)}%
              </div>
              <div className="info-item">
                <strong>Verified:</strong>{" "}
                {selectedProfile.verified ? "✓" : "✗"}
              </div>
            </div>

            <button
              className="btn danger"
              onClick={() => deleteProfile(selectedProfile.id)}
            >
              <Trash2 size={16} />
              Delete Profile
            </button>
          </div>
        )}
      </div>

      {/* Add Profile Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Profile</h3>
              <button onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={newProfile.username}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, username: e.target.value })
                  }
                  placeholder="Enter username"
                />
              </div>

              <div className="form-group">
                <label>Platform:</label>
                <select
                  value={newProfile.platform}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, platform: e.target.value })
                  }
                >
                  <option value="twitter">Twitter</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={addProfile}
                disabled={!newProfile.username.trim()}
              >
                Add Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialNetworkMapper;
