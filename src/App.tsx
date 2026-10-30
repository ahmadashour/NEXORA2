/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PortalsSection } from './components/PortalsSection';
import { QuickAccessSection } from './components/QuickAccessSection';
import { LatestContentSection } from './components/LatestContentSection';
import { CommunitySection } from './components/CommunitySection';
import { Footer } from './components/Footer';

// Modals
import { PortalModal } from './components/modals/PortalModal';
import { LabModal } from './components/modals/LabModal';
import { AiAssistantModal } from './components/modals/AiAssistantModal';
import { LibraryModal } from './components/modals/LibraryModal';
import { AcademyModal } from './components/modals/AcademyModal';
import { SearchModal } from './components/modals/SearchModal';
import { AuthModal } from './components/modals/AuthModal';
import { ContentDetailModal } from './components/modals/ContentDetailModal';
import { PostDetailModal } from './components/modals/PostDetailModal';
import { ContributeModal } from './components/modals/ContributeModal';
import { ContactModal } from './components/modals/ContactModal';
import { PrivacyModal } from './components/modals/PrivacyModal';

// Types
import { PortalItem, ContentItem, CommunityPost, UserSession } from './types';
import { PORTALS_DATA } from './data/mockData';

export default function App() {
  // Modal states
  const [selectedPortal, setSelectedPortal] = useState<PortalItem | null>(null);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAcademyOpen, setIsAcademyOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({
    isOpen: false,
    mode: 'login'
  });
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // User session state
  const [userSession, setUserSession] = useState<UserSession>({
    isLoggedIn: false
  });

  // Global search shortcut listener (press '/' or 'Ctrl+K' / 'Cmd+K')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalConfig({ isOpen: true, mode });
  };

  const handleLogout = () => {
    setUserSession({ isLoggedIn: false });
  };

  const handleQuickTool = (toolId: string) => {
    switch (toolId) {
      case 'lab':
        setIsLabOpen(true);
        break;
      case 'ai-assistant':
        setIsAiAssistantOpen(true);
        break;
      case 'library':
        setIsLibraryOpen(true);
        break;
      case 'academy':
        setIsAcademyOpen(true);
        break;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-slate-800 antialiased font-tajawal selection:bg-[#00A7B5]/20 selection:text-[#0B3D5B]">
      
      {/* 1. Header (Sticky Top Bar Contract) */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAuth={handleOpenAuth}
        userSession={userSession}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <Hero
          onDiscover={() => handleNavigate('portals')}
          onStartJourney={() => handleOpenAuth('register')}
          onOpenQuickLab={() => setIsLabOpen(true)}
        />

        {/* 3. User Portals Section (6 cards) */}
        <PortalsSection
          onSelectPortal={(portal) => setSelectedPortal(portal)}
        />

        {/* 4. Quick Access Section (4 tools) */}
        <QuickAccessSection
          onOpenLab={() => setIsLabOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenAcademy={() => setIsAcademyOpen(true)}
        />

        {/* 5. Latest Content Section (Resources, Videos, News, Events) */}
        <LatestContentSection
          onSelectContent={(item) => setSelectedContent(item)}
          onViewAllResources={() => setIsLibraryOpen(true)}
        />

        {/* 6. Community Section (Teacher Contributions) */}
        <CommunitySection
          onSelectPost={(post) => setSelectedPost(post)}
          onOpenContribute={() => setIsContributeOpen(true)}
        />
      </main>

      {/* 7. Footer */}
      <Footer
        onSelectPortal={(portal) => setSelectedPortal(portal)}
        onOpenQuickTool={handleQuickTool}
        onOpenContact={() => setIsContactOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
      />

      {/* Modals & Dialogs */}
      <PortalModal
        portal={selectedPortal}
        onClose={() => setSelectedPortal(null)}
        onLaunchVirtualLab={() => setIsLabOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
      />

      <LabModal
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
      />

      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
      />

      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
      />

      <AcademyModal
        isOpen={isAcademyOpen}
        onClose={() => setIsAcademyOpen(false)}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPortal={(portal) => setSelectedPortal(portal)}
        onSelectContent={(item) => setSelectedContent(item)}
        onSelectPost={(post) => setSelectedPost(post)}
        onOpenLab={() => setIsLabOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
      />

      <AuthModal
        isOpen={authModalConfig.isOpen}
        initialMode={authModalConfig.mode}
        onClose={() => setAuthModalConfig({ isOpen: false, mode: 'login' })}
        onLoginSuccess={(session) => setUserSession(session)}
      />

      <ContentDetailModal
        item={selectedContent}
        onClose={() => setSelectedContent(null)}
      />

      <PostDetailModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
      />

      <ContributeModal
        isOpen={isContributeOpen}
        onClose={() => setIsContributeOpen(false)}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

    </div>
  );
}
