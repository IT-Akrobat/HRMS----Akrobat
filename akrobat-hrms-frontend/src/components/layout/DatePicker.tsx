import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function DatePicker() {
    const [open, setOpen] = useState(false);

    const today = new Date();

    const [currentMonth, setCurrentMonth] = useState(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );

    const calendarRef = useRef(null);

    const formattedDate = today.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
    });

    const dayName = today.toLocaleDateString("en-US", {
        weekday: "long",
    });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    useEffect(() => {
        const handleOutside = (event) => {
            if (
                calendarRef.current &&
                !calendarRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutside);

        return () => {
            document.removeEventListener("mousedown", handleOutside);
        };
    }, []);

    const previousMonth = () => {
        setCurrentMonth(
            new Date(year, month - 1, 1)
        );
    };

    const nextMonth = () => {
        setCurrentMonth(
            new Date(year, month + 1, 1)
        );
    };


    return (
        <div ref={calendarRef} className="relative">

            <button
                onClick={() => setOpen(!open)}
                className="
                    flex
                    items-center
                    gap-2
                    text-sm
                    text-slate-600
                    hover:text-orange-500
                "
            >
                <Calendar size={17} />

                <div className="hidden lg:flex items-center gap-2">
                    <span className="font-medium">
                        {formattedDate}
                    </span>

                    <span className="text-slate-300">|</span>

                    <span>{dayName}</span>
                </div>
            </button>


            {open && (
                <div
                    className="
                        absolute
                        top-full
                        mt-2
                        right-0
                        w-64
                        bg-white
                        rounded-xl
                        border
                        border-slate-200
                        shadow-lg
                        p-4
                        z-50
                    "
                >

                    {/* Month Navigation */}
                    <div className="
                        flex
                        items-center
                        justify-between
                        mb-4
                    ">
                        <button
                            onClick={previousMonth}
                            className="
                                p-1
                                rounded-md
                                hover:bg-orange-50
                                text-slate-600
                            "
                        >
                            <ChevronLeft size={16} />
                        </button>


                        <h3
                            className="
                                text-sm
                                font-semibold
                                text-slate-700
                            "
                        >
                            {currentMonth.toLocaleDateString(
                                "en-US",
                                {
                                    month: "long",
                                    year: "numeric"
                                }
                            )}
                        </h3>


                        <button
                            onClick={nextMonth}
                            className="
                                p-1
                                rounded-md
                                hover:bg-orange-50
                                text-slate-600
                            "
                        >
                            <ChevronRight size={16} />
                        </button>

                    </div>


                    {/* Week Header */}
                    <div
                        className="
                            grid
                            grid-cols-7
                            mb-2
                            text-[11px]
                            font-bold
                            text-blue-900
                        "
                    >
                        {[
                            "S",
                            "M",
                            "T",
                            "W",
                            "T",
                            "F",
                            "S",
                        ].map((day, index) => (
                            <span
                                key={index}
                                className="text-center"
                            >
                                {day}
                            </span>
                        ))}
                    </div>


                    {/* Dates */}
                    <div
                        className="
                            grid
                            grid-cols-7
                            gap-1
                        "
                    >

                        {/* Empty spaces before first date */}
                        {Array.from({
                            length: firstDay
                        }).map((_, i) => (
                            <span key={i} />
                        ))}


                        {Array.from({
                            length: daysInMonth
                        },
                            (_, i) => i + 1
                        )
                            .map(day => {

                                const isToday =
                                    day === today.getDate() &&
                                    month === today.getMonth() &&
                                    year === today.getFullYear();


                                return (
                                    <button
                                        key={day}
                                        className={`
                                        h-7
                                        w-7
                                        rounded-md
                                        text-[11px]
                                        relative

                                        ${isToday
                                                ?
                                                "text-orange-500 font-bold"
                                                :
                                                "text-slate-600 hover:bg-orange-50"
                                            }
                                    `}
                                    >

                                        {day}


                                        {isToday && (
                                            <span
                                                className="
                                                absolute
                                                bottom-0.5
                                                left-1/2
                                                -translate-x-1/2
                                                w-1
                                                h-1
                                                rounded-full
                                                bg-orange-500
                                            "
                                            />
                                        )}

                                    </button>
                                );
                            })}

                    </div>

                </div>
            )}

        </div>
    );
}