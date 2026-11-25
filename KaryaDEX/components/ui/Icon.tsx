/**
 * KaryaDEX — Vector Icon System
 * 
 * Crisp, monochrome, Apple-inspired vector icons for Liquid Glass UI.
 * Zero font dependencies, 100% reliable across iOS, Android, and Web.
 */

import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type NavIconName = 'Today' | 'Schedule' | 'Tasks' | 'Study' | 'Attendance' | 'College' | 'LOCKIN' | 'Playground';

export interface IconProps {
  size?: number;
  color?: string;
  focused?: boolean;
}

export function TodayIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Calendar body */}
      <Rect
        x="3"
        y="4.5"
        width="18"
        height="16"
        rx="4"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Header bar */}
      <Path
        d="M3 9.5H21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Left pin */}
      <Path
        d="M8 2.5V5.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Right pin */}
      <Path
        d="M16 2.5V5.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Today focal dot or sun accent */}
      {focused ? (
        <Circle cx="12" cy="14.5" r="2.2" fill={color} />
      ) : (
        <Circle cx="12" cy="14.5" r="1.8" stroke={color} strokeWidth={strokeWidth} />
      )}
    </Svg>
  );
}

export function ScheduleIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Schedule clock / timetable card */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Clock hands */}
      <Path
        d="M12 7V12L15.5 14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TasksIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Checkbox circular container */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Checkmark */}
      <Path
        d="M8.5 12L11 14.5L16 9.5"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StudyIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Open Book spine & left page */}
      <Path
        d="M3 4.5H9C11 4.5 12 5.8 12 7.5V20.5C12 19 10.8 18 9 18H3V4.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Open Book right page */}
      <Path
        d="M21 4.5H15C13 4.5 12 5.8 12 7.5V20.5C12 19 13.2 18 15 18H21V4.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Academic reading lines */}
      <Path
        d="M6 8.5H9M6 12H8.5M15 8.5H18M15.5 12H18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AttendanceIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Analytics donut / circular gauge */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="28 14"
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Inner bar indicator */}
      <Path
        d="M12 8V12L14.5 14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

export function CollegeIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Graduation Cap / Academic mortarboard */}
      <Path
        d="M12 3L2 8.5L12 14L22 8.5L12 3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Cap base / neck */}
      <Path
        d="M6 10.7V16.5C6 16.5 8.5 19 12 19C15.5 19 18 16.5 18 16.5V10.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Tassel */}
      <Path
        d="M22 8.5V14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockInIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Timer circle */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={focused ? `${color}18` : 'none'}
      />
      {/* Timer hands */}
      <Path
        d="M12 8V12L15 15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Focus lock dot */}
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

export function PlaygroundIcon({ size = 20, color = '#FFFFFF', focused = false }: IconProps) {
  const strokeWidth = focused ? 2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Gamepad / Cyber Matrix Controller */}
      <Path
        d="M6 7H18C19.6569 7 21 8.34315 21 10V15C21 17.2091 19.2091 19 17 19L14.2 16.5H9.8L7 19C4.79086 19 3 17.2091 3 15V10C3 8.34315 4.34315 7 6 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={focused ? `${color}18` : 'none'}
        strokeLinejoin="round"
      />
      {/* D-Pad cross */}
      <Path
        d="M6.5 11.5H9.5M8 10V13"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Action buttons */}
      <Circle cx="15" cy="12.5" r="1.1" fill={color} />
      <Circle cx="17.5" cy="10.5" r="1.1" fill={color} />
    </Svg>
  );
}

export function NavIcon({
  name,
  size = 20,
  color,
  focused = false,
}: {
  name: NavIconName;
  size?: number;
  color?: string;
  focused?: boolean;
}) {
  switch (name) {
    case 'Today':
      return <TodayIcon size={size} color={color} focused={focused} />;
    case 'Schedule':
      return <ScheduleIcon size={size} color={color} focused={focused} />;
    case 'Tasks':
      return <TasksIcon size={size} color={color} focused={focused} />;
    case 'Study':
      return <StudyIcon size={size} color={color} focused={focused} />;
    case 'Attendance':
      return <AttendanceIcon size={size} color={color} focused={focused} />;
    case 'College':
      return <CollegeIcon size={size} color={color} focused={focused} />;
    case 'LOCKIN':
      return <LockInIcon size={size} color={color} focused={focused} />;
    case 'Playground':
      return <PlaygroundIcon size={size} color={color} focused={focused} />;
    default:
      return <TodayIcon size={size} color={color} focused={focused} />;
  }
}
