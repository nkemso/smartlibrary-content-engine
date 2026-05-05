/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WhopApp } from "@whop/react";

const TopAppBar = () => (
  <header className="fixed top-0 left-0 w-full h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-40">
    <div className="flex items-center gap-3 cursor-pointer">
      <span className="material-symbols-outlined text-indigo-500 hover:text-white transition-colors">menu</span>
      <span className="font-sans text-lg font-black tracking-tight text-indigo-500">SmartLibrary</span>
    </div>
    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-800 shadow-sm cursor-pointer">
      <img 
        alt="User Profile" 
        className="w-full h-full object-cover" 
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfdXKZoa7oyP9CDaUHvMjW0NUJYvgJcZvDU6hHu69bNknTDumc3yRM5WjfH6QLKeRVzzivEipOIPe8vEp1Pv1Ep3Xzp4MRr4q1UddU6reuufSOCU0Fe7wZAMPWDizKAS9Lc1BCdsG5W8wHoGuVWgns4N6ufsXKHEy5mPvSzl_ntyvUyW6oErCXmFri8kXn5jjRkSD-CnmNs0KFbP_2ul_VoXWOkW6ldvfAoEUlhFEDj1VRgnc7i17fc9YowWncuWdX9jx90yt_jhw"
      />
    </div>
  </header>
);

const FAB = () => (
  <motion.button 
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    className="fixed bottom-24 right-4 w-14 h-14 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary-container/20 z-30"
  >
    <span className="material-symbols-outlined">add</span>
  </motion.button>
);

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const tabs = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'chat', icon: 'forum', label: 'Chat Engine' },
    { id: 'library', icon: 'folder_managed', label: 'Library' },
    { id: 'admin', icon: 'admin_panel_settings', label: 'Admin Panel' }
  ];

  return (
    <nav className="fixed bottom-0 w-full h-20 bg-surface-container-highest/95 backdrop-blur-xl flex justify-around items-center px-2 z-40 pb-2 shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 cursor-pointer transition-colors ${
            activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <div className={`w-12 h-8 rounded-full flex items-center justify-center mb-0.5 transition-colors ${
            activeTab === tab.id ? 'bg-primary-container/20' : ''
          }`}>
            <span 
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${activeTab === tab.id ? 1 : 0}` }}
            >
              {tab.icon}
            </span>
          </div>
          <span className="text-code-xs uppercase font-bold tracking-wider">{tab.label.split(' ')[0]}</span>
        </button>
      ))}
    </nav>
  );
};

const DashboardContent = () => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="flex flex-col gap-6"
  >
    {/* Greeting & Search */}
    <section className="flex flex-col gap-4">
      <h1 className="text-headline-md font-semibold text-on-surface tracking-tight">Welcome back, Curator</h1>
      <div className="relative w-full group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">search</span>
        </div>
        <input 
          className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-base rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm placeholder:text-outline backdrop-blur-sm" 
          placeholder="Semantic search queries..." 
          type="text"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          <button className="bg-surface-variant text-on-surface-variant hover:text-on-surface rounded-lg p-1 transition-colors">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
        </div>
      </div>
    </section>

    {/* Stats Grid */}
    <section className="grid grid-cols-2 gap-4">
      <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-outline transition-colors">
        <div className="w-10 h-10 rounded-full bg-secondary-container/20 text-secondary-container flex items-center justify-center mb-4">
          <span className="material-symbols-outlined">description</span>
        </div>
        <div>
          <p className="text-label-sm font-medium text-on-surface-variant">Total Documents</p>
          <p className="text-headline-md font-semibold text-on-surface mt-1">1,432</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary-container/5 rounded-full blur-2xl group-hover:bg-secondary-container/10 transition-colors"></div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-outline transition-colors">
        <div className="w-10 h-10 rounded-full bg-tertiary-container/20 text-tertiary-container flex items-center justify-center mb-4">
          <span className="material-symbols-outlined">forum</span>
        </div>
        <div>
          <p className="text-label-sm font-medium text-on-surface-variant">Active Threads</p>
          <p className="text-headline-md font-semibold text-on-surface mt-1">24</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-tertiary-container/5 rounded-full blur-2xl group-hover:bg-tertiary-container/10 transition-colors"></div>
      </div>

      <div className="col-span-2 bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">cloud</span>
            <span className="text-label-sm font-medium">Storage Capacity</span>
          </div>
          <span className="text-label-sm font-medium text-on-surface">45GB / 100GB</span>
        </div>
        <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full w-[45%] relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
          </div>
        </div>
      </div>
    </section>

    {/* Recent Activities */}
    <section className="flex flex-col gap-3 pb-8">
      <h2 className="text-label-sm font-medium text-on-surface-variant uppercase tracking-wider mb-2">Recent Engine Activity</h2>
      
      <div className="p-4 bg-surface-container border border-outline-variant rounded-xl flex gap-4 items-start relative group transition-all hover:bg-surface-container-high cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label-sm font-medium text-on-surface truncate">AI processed document</p>
          <p className="text-body-md text-on-surface-variant mt-0.5 truncate">Q3_Financial_Analysis_Draft.pdf</p>
          <div className="flex gap-2 mt-2">
            <span className="inline-flex px-2 py-0.5 rounded-md bg-primary-container/20 text-primary text-code-xs font-bold border border-primary/20">Summary Generated</span>
          </div>
        </div>
        <span className="text-code-xs text-outline absolute top-4 right-4">2m</span>
      </div>

      <div className="p-4 bg-surface-container border border-outline-variant rounded-xl flex gap-4 items-start relative group transition-all hover:bg-surface-container-high cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary text-[20px]">link</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label-sm font-medium text-on-surface truncate">New link added</p>
          <p className="text-body-md text-on-surface-variant mt-0.5 truncate">Source: Whop API Documentation</p>
        </div>
        <span className="text-code-xs text-outline absolute top-4 right-4">1h</span>
      </div>

      <div className="p-4 bg-surface-container border border-outline-variant rounded-xl flex gap-4 items-start relative group opacity-75 grayscale hover:grayscale-0 transition-all hover:opacity-100 cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-outline text-[20px]">person_add</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label-sm font-medium text-on-surface truncate">Workspace invite accepted</p>
          <p className="text-body-md text-on-surface-variant mt-0.5 truncate">Sarah J. joined 'Research Alpha'</p>
        </div>
        <span className="text-code-xs text-outline absolute top-4 right-4">5h</span>
      </div>
    </section>
  </motion.div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <WhopApp sdkOptions={{ appId: "app_biz_NmM39BeWPkA2dn/developer/" }}>
    <div className="min-h-screen bg-background text-on-background pb-32">
      <TopAppBar />
      
      <main className="pt-24 px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardContent />
          )}
          {activeTab !== 'dashboard' && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-6xl mb-4 opacity-20">construction</span>
              <p className="text-lg font-medium opacity-50 underline decoration-primary underline-offset-8">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View Under Construction
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <FAB />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
      </WhopApp>
  );
}
