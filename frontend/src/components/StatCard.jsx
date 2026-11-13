import React from 'react';

const StatCard = ({ title, value, icon, colorTheme = 'primary', subtitle, badgeText }) => {
  const themeMap = {
    primary: {
      bgIcon: 'bg-primary bg-opacity-10 text-primary',
      badge: 'bg-primary bg-opacity-10 text-primary border-primary border-opacity-25'
    },
    success: {
      bgIcon: 'bg-success bg-opacity-10 text-success',
      badge: 'bg-success bg-opacity-10 text-success border-success border-opacity-25'
    },
    info: {
      bgIcon: 'bg-info bg-opacity-10 text-info',
      badge: 'bg-info bg-opacity-10 text-info border-info border-opacity-25'
    },
    warning: {
      bgIcon: 'bg-warning bg-opacity-10 text-warning',
      badge: 'bg-warning bg-opacity-10 text-warning border-warning border-opacity-25'
    }
  };

  const theme = themeMap[colorTheme] || themeMap.primary;

  return (
    <div className="card h-100 border-0 shadow-sm p-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="text-uppercase fw-bold text-muted" style={{ fontSize: '0.78rem', letterSpacing: '0.5px' }}>
          {title}
        </span>
        <div className={`stat-icon-wrapper ${theme.bgIcon}`}>
          <i className={`bi ${icon}`}></i>
        </div>
      </div>
      <div>
        <h3 className="fw-bolder mb-1 text-dark" style={{ fontSize: '2.2rem' }}>{value}</h3>
        <div className="d-flex align-items-center justify-content-between mt-2">
          {subtitle && <small className="text-muted">{subtitle}</small>}
          {badgeText && (
            <span className={`badge border rounded-pill px-2 py-1 ${theme.badge}`} style={{ fontSize: '0.72rem' }}>
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
