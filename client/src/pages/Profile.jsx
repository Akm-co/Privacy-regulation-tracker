import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HiOutlineUser, HiOutlineCog, HiOutlineKey, HiOutlineBell } from 'react-icons/hi';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    organization: user?.organization || '',
    jobTitle: user?.jobTitle || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateProfile(formData);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: HiOutlineUser },
    { id: 'preferences', label: 'Preferences', icon: HiOutlineCog },
    { id: 'notifications', label: 'Notifications', icon: HiOutlineBell },
    { id: 'security', label: 'Security', icon: HiOutlineKey }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Account Settings</h1>

      <div className="card overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-surface-200 dark:border-surface-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-accent-500 text-accent-500'
                  : 'text-surface-500 hover:text-surface-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="input bg-surface-100 dark:bg-surface-700"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Organization</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Job Title</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary">
                Save Changes
              </button>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Watched Regions</h3>
                <p className="text-surface-500">Configure which regions you want to monitor</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Email Notifications</h3>
                <p className="text-surface-500">Configure your notification preferences</p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Change Password</h3>
                <p className="text-surface-500">Update your account password</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
