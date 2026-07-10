// import React, { useState } from 'react';
// import { Search, Bell, MessageSquare, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
// import { useAuth } from '../../context/AuthContext';
// import { ROLE_LABELS } from '../../config/roles';

// export default function Header() {
//   const { user, role, logout } = useAuth();
//   const [menuOpen, setMenuOpen] = useState(false);

//   const today = new Date().toLocaleDateString('en-US', {
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric',
//     weekday: 'long',
//   });

//   return (
//     <header className="h-16 flex items-center justify-between gap-4 px-6 bg-white border-b border-slate-200 sticky top-0 z-10">
//       <div className="flex items-center gap-2 flex-1 max-w-md">
//         <div className="relative w-full">
//           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//           <input
//             type="text"
//             placeholder="Search anything..."
//             className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
//           />
//         </div>
//       </div>

//       <div className="flex items-center gap-5">
//         <span className="hidden md:block text-sm text-slate-500">{today}</span>

//         <button className="relative text-slate-500 hover:text-slate-800">
//           <Bell size={20} />
//           <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
//             3
//           </span>
//         </button>

//         <button className="relative text-slate-500 hover:text-slate-800">
//           <MessageSquare size={20} />
//           <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
//             2
//           </span>
//         </button>

//         <div className="relative">
//           <button
//             onClick={() => setMenuOpen((o) => !o)}
//             className="flex items-center gap-2"
//           >
//             <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm overflow-hidden">
//               {user?.avatar ? (
//                 <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
//               ) : (
//                 user?.name?.[0] ?? 'U'
//               )}
//             </div>
//             <div className="text-left hidden sm:block">
//               <div className="text-sm font-medium text-slate-800 leading-tight">{user?.name}</div>
//               <div className="text-xs text-slate-400 leading-tight">{ROLE_LABELS[role]}</div>
//             </div>
//             <ChevronDown size={16} className="text-slate-400" />
//           </button>

//           {menuOpen && (
//             <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1">
//               <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
//                 <UserIcon size={15} /> My Profile
//               </button>
//               <button
//                 onClick={logout}
//                 className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
//               >
//                 <LogOut size={15} /> Logout
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </header>
//   );
// }
import {
  Bell,
  ChevronDown,
  LogOut,
  MessageSquare,
  Search,
  User as UserIcon,
} from "lucide-react";

import { useState } from "react";
import { ROLE_LABELS } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import DatePicker from "./DatePicker";

export default function Header() {
  const { user, role, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="
        h-16
        flex
        items-center
        justify-between
        px-4
        sm:px-6
        bg-white
        border-b
        border-slate-200
        sticky
        top-0
        z-20
      "
    >
      {/* Search */}
      <div
        className="
          flex-1
          max-w-md
        "
      >
        <div className="relative">
          <Search
            size={16}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            placeholder="Search anything..."
            className="
              w-full
              pl-9
              pr-3
              py-2
              rounded-lg
              border
              border-slate-200
              text-sm
              outline-none
              focus:ring-2
              focus:ring-orange-500/30
            "
          />
        </div>
      </div>

      <div
        className="
          flex
          items-center
          gap-3
          sm:gap-5
          ml-3
        "
      >
        {/* Date Picker */}
        <DatePicker />

        {/* Notification */}
        <button className="relative text-slate-500">
          <Bell size={20} />

          <span
            className="
              absolute
              -top-1
              -right-1
              bg-red-500
              text-white
              text-[10px]
              rounded-full
              w-4
              h-4
              flex
              items-center
              justify-center
            "
          >
            3
          </span>
        </button>

        {/* Messages */}
        <button className="relative text-slate-500">
          <MessageSquare size={20} />

          <span
            className="
              absolute
              -top-1
              -right-1
              bg-red-500
              text-white
              text-[10px]
              rounded-full
              w-4
              h-4
              flex
              items-center
              justify-center
            "
          >
            2
          </span>
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="
              flex
              items-center
              gap-2
            "
          >
            <div
              className="
                w-9
                h-9
                rounded-full
                bg-slate-200
                flex
                items-center
                justify-center
                font-semibold
              "
            >
              {user?.name?.[0] ?? "U"}
            </div>

            {/* Hide text on mobile */}
            <div
              className="
                hidden
                md:block
                text-left
              "
            >
              <p
                className="
                  text-sm
                  font-medium
                  text-slate-800
                "
              >
                {user?.name}
              </p>

              <p
                className="
                  text-xs
                  text-slate-400
                "
              >
                {ROLE_LABELS[role]}
              </p>
            </div>

            <ChevronDown size={16} className="hidden sm:block" />
          </button>

          {menuOpen && (
            <div
              className="
                absolute
                right-0
                mt-2
                w-48
                bg-white
                shadow-lg
                rounded-lg
                border
                py-2
                z-50
              "
            >
              <button
                className="
                  px-4
                  py-2
                  flex
                  gap-2
                  text-sm
                "
              >
                <UserIcon size={15} />
                My Profile
              </button>

              <button
                onClick={logout}
                className="
                  px-4
                  py-2
                  flex
                  gap-2
                  text-sm
                  text-red-500
                "
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
