'use client';

import { useState, useEffect } from 'react';

const navItems = [
  { label: 'Overview', id: 'overview' },
  { label: 'Monthly Trend', id: 'monthly-trend' },
  { label: 'Demand Patterns', id: 'demand-patterns' },
  { label: 'Shipments', id: 'shipments' },
  { label: 'Terminals', id: 'terminals' },
  { label: 'Cities', id: 'cities' },
  { label: 'Maps', id: 'maps' },
  { label: 'Logistics', id: 'Logistics' },
];

export default function Navigation() {
  const [activeItem, setActiveItem] = useState('overview');

  const handleNavClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 80; // Approximate height of sticky nav
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setActiveItem(id);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => item.id);
      const scrollPosition = window.scrollY + 150; // Account for sticky nav height

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveItem(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-slate-950">
      <div className="container mx-auto px-8 py-4">
        <div className="flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                px-5 py-3 text-base font-medium transition-colors text-white
                ${
                  activeItem === item.id
                    ? 'bg-green-600 rounded-lg'
                    : 'hover:text-gray-300'
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

