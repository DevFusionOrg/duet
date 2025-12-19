import React from 'react';
import '../styles/UserBadge.css';

function UserBadge({ badge, size = 'small' }) {
  if (!badge) return null;

  const DeveloperIcon = () => (
    
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <text x="12" y="16" fontSize="18" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="monospace">&lt;/&gt;</text>
    </svg>
  );

  const SupportIcon = () => (
    
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 18c-3.48-1.14-6-5.06-6-8v-4.89l6-2.72 6 2.72V11c0 2.94-2.52 6.86-6 8z"/>
    </svg>
  );

  const TesterIcon = () => (
    
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l5 6-5 14-5-14 5-6z" fill="currentColor" stroke="none"/>
      <path d="M7 8h10" />
      <path d="M9.5 8L12 22" />
      <path d="M14.5 8L12 22" />
      <path d="M12 2l-5 6" />
      <path d="M12 2l5 6" />
    </svg>
  );

  const badgeConfig = {
    developer: {
      label: 'Developer',
      icon: <DeveloperIcon />,
      className: 'badge-developer'
    },
    support: {
      label: 'Support',
      icon: <SupportIcon />,
      className: 'badge-support'
    },
    tester: {
      label: 'Tester',
      icon: <TesterIcon />,
      className: 'badge-tester'
    }
  };

  const config = badgeConfig[badge];
  if (!config) return null;

  return (
    <span className={`user-badge badge-${size} ${config.className}`} title={config.label}>
      {config.icon}
    </span>
  );
}

export default UserBadge;
