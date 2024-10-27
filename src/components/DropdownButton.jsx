import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";

const DropdownButton = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      className="relative inline-block text-left mx-3"
      ref={dropdownRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}>
      {/* Button */}
      <button className="flex items-center px-4 py-2 text-[#3f1d75] border-[1px] border-solid rounded-md hover:border-[#3f1d75] ">
        {data.name}
      </button>
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-10 mt-[1px] w-36 bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="py-1">
            {data.list &&
              data.list.map((item) => (
                <li
                  key={item}
                  className="block px-4 py-2 text-sm text-gray-500 font-semibold hover:text-[#0e8d93] cursor-pointer">
                  {item}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

DropdownButton.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    list: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};

export default DropdownButton;
