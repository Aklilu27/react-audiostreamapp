import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="sidebar-menu"
      >
        Menu
        <span className={`sidebar-toggle__icon ${isOpen ? 'open' : ''}`}>
          ▾
        </span>
      </button>
      <nav
        id="sidebar-menu"
        className={`sidebar-nav ${isOpen ? 'open' : ''}`}
        aria-hidden={!isOpen}
      >
        <Link to="/home">Home</Link>
        <Link to="/chat">Video Rooms</Link>
        <Link to="/profile">Profile</Link>
      </nav>
    </aside>
  );
};

export default Sidebar;
