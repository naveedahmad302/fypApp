import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Home, FileText, BarChart2, Users, User } from 'lucide-react-native';

const NavItem = ({ icon: Icon, label, isActive = false, onPress }) => {
  const iconColor = isActive ? '#3B82F6' : '#9CA3AF';
  const textColor = isActive ? '#3B82F6' : '#9CA3AF';
  
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-1 items-center justify-center py-2"
    >
      <Icon size={24} color={iconColor} />
      <Text className={`text-xs mt-1 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const BottomNavigation = ({ activeTab = 'home', onTabPress }) => {
  const handleTabPress = (tab) => {
    if (onTabPress) {
      onTabPress(tab);
    }
  };

  return (
    <View className="bg-white border-t border-gray-100 px-4 py-2">
      <View className="flex-row">
        <NavItem 
          icon={Home} 
          label="Home" 
          isActive={activeTab === 'home'}
          onPress={() => handleTabPress('home')}
        />
        
        <NavItem 
          icon={FileText} 
          label="Assessment" 
          isActive={activeTab === 'assessment'}
          onPress={() => handleTabPress('assessment')}
        />
        
        <NavItem 
          icon={BarChart2} 
          label="Reports" 
          isActive={activeTab === 'reports'}
          onPress={() => handleTabPress('reports')}
        />
        
        <NavItem 
          icon={Users} 
          label="Support" 
          isActive={activeTab === 'support'}
          onPress={() => handleTabPress('support')}
        />
        
        <NavItem 
          icon={User} 
          label="Profile" 
          isActive={activeTab === 'profile'}
          onPress={() => handleTabPress('profile')}
        />
      </View>
    </View>
  );
};

export default BottomNavigation;
