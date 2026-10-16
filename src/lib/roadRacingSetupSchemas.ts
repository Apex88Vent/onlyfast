import type { ClassConfig, ClassSection, FieldDef } from './classConfigs.ts';

// Stable database IDs are independent of the display names. Labels and section
// order below mirror the supplied Road Racing sheets; every value starts blank.
interface RoadSheet { id: string; name: string; description: string; sections: { title: string; fields: string[]; corners?: { title: string; fields: string[] }[] }[] }
export const ROAD_SHEETS: RoadSheet[] = [
  {
    "id": "road_spec_miata",
    "name": "Mazda MX-5 / Spec Miata",
    "description": "",
    "sections": [
      {
        "title": "General Chassis & Track Info",
        "fields": [
          "Track Name / Layout",
          "Event / Date / Session",
          "Ambient Temp / Track Temp / Humidity",
          "Fuel Level (Gallons / Liters)",
          "Total Car Weight with Driver (lbs)",
          "Front Weight (lbs / %)",
          "Rear Weight (lbs / %)",
          "Left Weight (lbs / %)",
          "Right Weight (lbs / %)",
          "Cross Weight (%)",
          "Front Ride Height (Pinch Weld - Left & Right)",
          "Rear Ride Height (Pinch Weld - Left & Right)",
          "Front Total Toe",
          "Rear Total Toe",
          "Front Sway Bar Diameter & Arm Hole Position (1, 2, 3)",
          "Rear Sway Bar Diameter & End Link Status (Connected / Disconnected / Hole)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Spring Free Length",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Cold Air Pressure (PSI)",
              "Hot Air Pressure (PSI)",
              "Tire Size & Compound",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Pinch Weld Height (Inches)",
              "Control Arm Bushing Type (PB / Delrin / Spherical)",
              "Sway Bar Link Mount Hole"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Spring Free Length",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Cold Air Pressure (PSI)",
              "Hot Air Pressure (PSI)",
              "Tire Size & Compound",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Pinch Weld Height (Inches)",
              "Control Arm Bushing Type (PB / Delrin / Spherical)",
              "Sway Bar Link Mount Hole"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Spring Free Length",
              "Camber (Degrees)",
              "Toe (Inches / Degrees)",
              "Cold Air Pressure (PSI)",
              "Hot Air Pressure (PSI)",
              "Tire Size & Compound",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Pinch Weld Height (Inches)",
              "Sway Bar Link Mount Position"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Spring Free Length",
              "Camber (Degrees)",
              "Toe (Inches / Degrees)",
              "Cold Air Pressure (PSI)",
              "Hot Air Pressure (PSI)",
              "Tire Size & Compound",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Pinch Weld Height (Inches)",
              "Sway Bar Link Mount Position"
            ]
          }
        ]
      },
      {
        "title": "Drivetrain & Brakes",
        "fields": [
          "Brake Bias Proportioning Valve (Turns Out from Full Closed)",
          "Front Brake Pad Compound",
          "Rear Brake Pad Compound",
          "Differential Type (Torsen / OS Giken Clutch)",
          "Differential Preload / Ramp Specs",
          "Transmission Fluid / Diff Fluid Spec"
        ]
      }
    ]
  },
  {
    "id": "road_gt3",
    "name": "GT3",
    "description": "Porsche 911 GT3 R, BMW M4 GT3, Ferrari 296 GT3",
    "sections": [
      {
        "title": "General Chassis & Aero Platform",
        "fields": [
          "Track Name / Session / Date",
          "Ambient Temp / Track Temp / Track Condition (Dry / Damp / Wet)",
          "Fuel Load (Liters) / Total Weight (kg)",
          "Front Weight (%) / Rear Weight (%) / Cross Weight (%)",
          "Static Front Ride Height (mm) / Static Rear Ride Height (mm)",
          "Dynamic Front Ride Height at Target Speed (mm)",
          "Dynamic Rear Ride Height at Target Speed (mm)",
          "Rake Angle (Degrees / mm delta)",
          "Front Splitter Gurney Height (mm)",
          "Front Dive Planes / Canards Installed (Yes / No)",
          "Rear Wing Angle Setting (Degrees / Hole Position)",
          "Rear Wing Gurney Flap Height (mm)",
          "Front Anti-Roll Bar Blade Setting (1 to 7)",
          "Rear Anti-Roll Bar Blade Setting (1 to 7)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Damper Brand & Model",
              "Low-Speed Compression (Clicks)",
              "High-Speed Compression (Clicks)",
              "Low-Speed Rebound (Clicks)",
              "High-Speed Rebound (Clicks)",
              "Main Spring Rate (N/mm) & Free Length",
              "Helper Spring Rate (N/mm) & Block Height",
              "Bumpstop Material / Length / Gap (mm)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (mm)",
              "Corner Weight (kg)",
              "Cold Air Pressure (Bar / PSI)",
              "Hot Air Pressure (Bar / PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Thickness (mm) & Pad Compound"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Damper Brand & Model",
              "Low-Speed Compression (Clicks)",
              "High-Speed Compression (Clicks)",
              "Low-Speed Rebound (Clicks)",
              "High-Speed Rebound (Clicks)",
              "Main Spring Rate (N/mm) & Free Length",
              "Helper Spring Rate (N/mm) & Block Height",
              "Bumpstop Material / Length / Gap (mm)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (mm)",
              "Corner Weight (kg)",
              "Cold Air Pressure (Bar / PSI)",
              "Hot Air Pressure (Bar / PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Thickness (mm) & Pad Compound"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Damper Brand & Model",
              "Low-Speed Compression (Clicks)",
              "High-Speed Compression (Clicks)",
              "Low-Speed Rebound (Clicks)",
              "High-Speed Rebound (Clicks)",
              "Main Spring Rate (N/mm) & Free Length",
              "Helper Spring Rate (N/mm) & Block Height",
              "Bumpstop Material / Length / Gap (mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Corner Weight (kg)",
              "Cold Air Pressure (Bar / PSI)",
              "Hot Air Pressure (Bar / PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Thickness (mm) & Pad Compound"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Damper Brand & Model",
              "Low-Speed Compression (Clicks)",
              "High-Speed Compression (Clicks)",
              "Low-Speed Rebound (Clicks)",
              "High-Speed Rebound (Clicks)",
              "Main Spring Rate (N/mm) & Free Length",
              "Helper Spring Rate (N/mm) & Block Height",
              "Bumpstop Material / Length / Gap (mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Corner Weight (kg)",
              "Cold Air Pressure (Bar / PSI)",
              "Hot Air Pressure (Bar / PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Thickness (mm) & Pad Compound"
            ]
          }
        ]
      },
      {
        "title": "Drivetrain & Electronics",
        "fields": [
          "Traction Control Map 1 (Cut Engine Power)",
          "Traction Control Map 2 (Slip Control)",
          "ABS Map Setting (1 to 12)",
          "Throttle Pedal Map (Linear / Dynamic)",
          "Brake Bias Setting (% Front)",
          "Differential Coast Ramp Angle / Power Ramp Angle",
          "Differential Preload (Nm)",
          "Gear Ratios (1st through 6th) / Final Drive"
        ]
      }
    ]
  },
  {
    "id": "road_gt4",
    "name": "GT4",
    "description": "Cayman GT4 CS, Mustang GT4, BMW M4 GT4",
    "sections": [
      {
        "title": "General Chassis & Aerodynamics",
        "fields": [
          "Track / Date / Session",
          "Air Temp / Track Temp",
          "Minimum Weight / BOP Ballast Added (kg)",
          "Ballast Position / Weight Distribution",
          "Fuel Load (Liters)",
          "Front Ride Height (mm)",
          "Rear Ride Height (mm)",
          "Front Total Toe (mm)",
          "Rear Total Toe (mm)",
          "Front Anti-Roll Bar Setting (Soft / Medium / Hard)",
          "Rear Anti-Roll Bar Setting (Soft / Medium / Hard)",
          "Rear Wing Angle / Hole Position",
          "Rear Wing Gurney Flap (mm)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Main Spring Rate (N/mm)",
              "Helper Spring Rate (N/mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Cold Pressure (PSI)",
              "Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Pad Thickness (mm)"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Main Spring Rate (N/mm)",
              "Helper Spring Rate (N/mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Cold Pressure (PSI)",
              "Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Pad Thickness (mm)"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Main Spring Rate (N/mm)",
              "Helper Spring Rate (N/mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Cold Pressure (PSI)",
              "Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Pad Thickness (mm)"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Main Spring Rate (N/mm)",
              "Helper Spring Rate (N/mm)",
              "Camber (Degrees)",
              "Toe (mm)",
              "Cold Pressure (PSI)",
              "Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Pad Thickness (mm)"
            ]
          }
        ]
      },
      {
        "title": "Driver Electronics & Brakes",
        "fields": [
          "ABS Setting Map",
          "Traction Control Setting Map",
          "Front Brake Bias (% Front)",
          "Differential Ramp & Preload Settings"
        ]
      }
    ]
  },
  {
    "id": "road_prototypes",
    "name": "Prototypes",
    "description": "LMDh, GTP, LMP2, LMP3",
    "sections": [
      {
        "title": "General Chassis & Aerodynamic Platform",
        "fields": [
          "Track Name / Date / Session",
          "Ambient Temp / Track Temp / Barometric Pressure",
          "Total Mass (kg) / Fuel Mass (kg)",
          "Front Weight (%) / Cross Weight (%)",
          "Static Front Ride Height (mm) / Static Rear Ride Height (mm)",
          "Dynamic Front Aero Ride Height (mm @ 200 km/h)",
          "Dynamic Rear Aero Ride Height (mm @ 200 km/h)",
          "Front Diffuser Ramp / Louver Setting",
          "Rear Wing Upper Element Angle (Degrees)",
          "Rear Wing Gurney Flap Height (mm)",
          "Underbody Skid Block Wear Measurements (FL, FR, Center, RL, RR)"
        ]
      },
      {
        "title": "Third Element & Heave Control",
        "fields": [
          "Front Heave Spring Rate (N/mm)",
          "Front Heave Damper Compression & Rebound Settings",
          "Front Heave Bumpstop Gap / Shim Stack (mm)",
          "Rear Heave Spring Rate (N/mm)",
          "Rear Heave Damper Compression & Rebound Settings",
          "Rear Heave Bumpstop Gap / Shim Stack (mm)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Torsion Bar Diameter / Rate (mm)",
              "Pushrod Shims / Length Adjustment (mm)",
              "Damper 4-Way Clicks (LS Comp / HS Comp / LS Reb / HS Reb)",
              "Camber (Degrees) / Caster (Degrees) / Toe (mm)",
              "Cold / Hot Pressure (Bar)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear & Pad Compound"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Torsion Bar Diameter / Rate (mm)",
              "Pushrod Shims / Length Adjustment (mm)",
              "Damper 4-Way Clicks (LS Comp / HS Comp / LS Reb / HS Reb)",
              "Camber (Degrees) / Caster (Degrees) / Toe (mm)",
              "Cold / Hot Pressure (Bar)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear & Pad Compound"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Corner Spring Rate (N/mm)",
              "Pushrod Shims / Length Adjustment (mm)",
              "Damper 4-Way Clicks (LS Comp / HS Comp / LS Reb / HS Reb)",
              "Camber (Degrees) / Toe (mm)",
              "Cold / Hot Pressure (Bar)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear & Pad Compound"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Corner Spring Rate (N/mm)",
              "Pushrod Shims / Length Adjustment (mm)",
              "Damper 4-Way Clicks (LS Comp / HS Comp / LS Reb / HS Reb)",
              "Camber (Degrees) / Toe (mm)",
              "Cold / Hot Pressure (Bar)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear & Pad Compound"
            ]
          }
        ]
      },
      {
        "title": "Hybrid Powertrain & Systems",
        "fields": [
          "MGU-K Deployment Map",
          "MGU-K Energy Regeneration Map",
          "Engine Brake / Lift-and-Coast Level",
          "Traction Control System Maps (Entry / Mid / Exit)",
          "Brake Migration Map (Front to Rear dynamic shift)",
          "Differential Power Ramp / Coast Ramp / Preload"
        ]
      }
    ]
  },
  {
    "id": "road_formula_winged",
    "name": "Winged Open-Wheel Formula",
    "description": "F3, Indy NXT, USF Pro",
    "sections": [
      {
        "title": "General Chassis & Aerodynamics",
        "fields": [
          "Track / Date / Session",
          "Air Temp / Track Temp",
          "Fuel Level (Liters) / Total Weight (kg)",
          "Front Weight (%) / Cross Weight (%)",
          "Static Front Pushrod Length / Static Rear Pushrod Length",
          "Static Front Ride Height (mm) / Static Rear Ride Height (mm)",
          "Front Wing Flap Angle (Degrees)",
          "Rear Wing Mainplane Angle (Degrees)",
          "Rear Wing Flap Angle (Degrees)",
          "Front Anti-Roll Bar Blade Position / Wire Diameter",
          "Rear Anti-Roll Bar Blade Position / Wire Diameter"
        ]
      },
      {
        "title": "Third / Heave Element",
        "fields": [
          "Front Heave Spring Rate (N/mm)",
          "Front Packer Shim Stack (mm)",
          "Front Bumpstop Gap (mm)",
          "Rear Heave Spring Rate (N/mm)",
          "Rear Packer Shim Stack (mm)",
          "Rear Bumpstop Gap (mm)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Corner Damper Compression (Clicks)",
              "Corner Damper Rebound (Clicks)",
              "Corner Spring Rate (N/mm)",
              "Camber (Degrees) / Caster (Degrees) / Toe (mm)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Corner Damper Compression (Clicks)",
              "Corner Damper Rebound (Clicks)",
              "Corner Spring Rate (N/mm)",
              "Camber (Degrees) / Caster (Degrees) / Toe (mm)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Corner Damper Compression (Clicks)",
              "Corner Damper Rebound (Clicks)",
              "Corner Spring Rate (N/mm)",
              "Camber (Degrees) / Toe (mm)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Corner Damper Compression (Clicks)",
              "Corner Damper Rebound (Clicks)",
              "Corner Spring Rate (N/mm)",
              "Camber (Degrees) / Toe (mm)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          }
        ]
      },
      {
        "title": "Drivetrain & Brakes",
        "fields": [
          "Brake Master Cylinder Sizes (Front / Rear)",
          "Brake Bias Cockpit Adjuster Position (% Front)",
          "Gear Ratios (1st through 6th) / Drop Gears"
        ]
      }
    ]
  },
  {
    "id": "road_formula_non_winged",
    "name": "Non-Winged Open-Wheel Formula",
    "description": "Formula Ford / Formula F",
    "sections": [
      {
        "title": "General Chassis & Geometry",
        "fields": [
          "Track / Date / Session",
          "Weather Conditions / Track Temp",
          "Total Weight with Driver (lbs)",
          "Front Weight (lbs / %)",
          "Rear Weight (lbs / %)",
          "Cross Weight (%)",
          "Front Ride Height (Chassis Frame Rail)",
          "Rear Ride Height (Chassis Frame Rail)",
          "Front Sway Bar Diameter & Adjustment Hole",
          "Rear Sway Bar Diameter & Adjustment Hole"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Rocker Link / Pushrod Adjustment Length"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Rocker Link / Pushrod Adjustment Length"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Radius Rod Mounting Hole"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Radius Rod Mounting Hole"
            ]
          }
        ]
      },
      {
        "title": "Drivetrain & Gearbox",
        "fields": [
          "Hewland Gear Ratios (1st, 2nd, 3rd, 4th)",
          "Final Drive Ring & Pinion Ratio",
          "Brake Bias Adjuster Setting",
          "Clutch Free Play / Fluid Condition"
        ]
      }
    ]
  },
  {
    "id": "road_karts",
    "name": "Go-Karts",
    "description": "Sprint / Shifter / TaG",
    "sections": [
      {
        "title": "General Frame & Setup",
        "fields": [
          "Track Name / Layout",
          "Ambient Temp / Track Temp",
          "Total Kart Weight with Driver (kg / lbs)",
          "Front Weight (%) / Rear Weight (%)",
          "Front Frame Torsion Bar (None / Nylon / Steel / Chromoly - Flat or Round)",
          "Rear Frame Torsion Bar (Installed / Removed)",
          "Side Bumper / Pod Mounting Bolt Tension (Tight / Loose)",
          "Seat Model & Stiffness Grade",
          "Seat Position: Front Lip to Front Frame Tube (cm)",
          "Seat Position: Seat Back Top to Rear Axle Center (cm)",
          "Seat Support Stays Count & Mounting Holes (2, 3, or 4 stays)"
        ]
      },
      {
        "title": "Front End Setup (Sniper Geometry)",
        "fields": [
          "Front Track Width (Washer Count: Inside vs. Outside Hub)",
          "Front Stub Axle Diameter (17mm / 25mm)",
          "Front Hub Length (75mm / 95mm)",
          "Top Eccentric Bushing Position (Caster / Camber Notch)",
          "Bottom Eccentric Bushing Position (Caster / Camber Notch)",
          "Front Ride Height Spacers (Above / Below Stub Axle)",
          "Front Toe (Sniper Grid Units / mm)"
        ]
      },
      {
        "title": "Rear End Setup",
        "fields": [
          "Rear Track Width (cm - Max 140cm)",
          "Rear Axle Model & Hardness Rating (Soft / Medium / Hard / Extra Hard)",
          "Rear Axle Wall Thickness (mm)",
          "Rear Hub Length (90mm / 115mm) & Material (Aluminum / Magnesium)",
          "Rear Ride Height Frame Mounting Holes (High / Medium / Low)",
          "Center Axle Bearing Cassette Status (Tight / Free / Removed)"
        ]
      },
      {
        "title": "Engine, Gearing & Tires",
        "fields": [
          "Front Drive Sprocket Teeth Count",
          "Rear Driven Sprocket Teeth Count",
          "Chain Type / Pitch",
          "Carburetor Main Jet / Pilot Jet / Needle Position",
          "Cold Tire Pressures (FL, FR, RL, RR)",
          "Hot Tire Pressures (FL, FR, RL, RR)",
          "Tire Temperatures (Inside / Middle / Outside)"
        ]
      }
    ]
  },
  {
    "id": "road_legends",
    "name": "Road Course Legends Car",
    "description": "",
    "sections": [
      {
        "title": "General Chassis & Symmetrical Setup",
        "fields": [
          "Track / Date / Session",
          "Air Temp / Track Temp",
          "Fuel Level (Gallons)",
          "Total Weight with Driver (lbs)",
          "Front Weight (lbs / %)",
          "Rear Weight (lbs / %)",
          "Left Weight (lbs / %)",
          "Right Weight (lbs / %)",
          "Cross Weight (%) - Targeting Symmetrical 50.0%",
          "Front Frame Height (Left & Right)",
          "Rear Frame Height (Left & Right)",
          "Front Sway Bar Diameter & Link Length",
          "Rear Stagger (0.0 Inches)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Shock Brand & Valving (Bump / Rebound)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Upper Control Arm Mount Position",
              "Steering Arm Hole Position"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Shock Brand & Valving (Bump / Rebound)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Caster (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Upper Control Arm Mount Position",
              "Steering Arm Hole Position"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Brand & Valving (Bump / Rebound)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Trailing Arm Chassis Mounting Hole (Top / Middle / Bottom)",
              "Trailing Arm Axle Mounting Hole"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Brand & Valving (Bump / Rebound)",
              "Spring Rate (lb/in)",
              "Camber (Degrees)",
              "Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Trailing Arm Chassis Mounting Hole (Top / Middle / Bottom)",
              "Trailing Arm Axle Mounting Hole"
            ]
          }
        ]
      },
      {
        "title": "Rear Geometry & Drivetrain",
        "fields": [
          "Panhard Bar Mount Height - Chassis Side (Inches)",
          "Panhard Bar Mount Height - Axle Side (Inches)",
          "Rear Axle Housing Alignment / Squareness (Inches)",
          "Rear End Gear Ratio",
          "Brake Proportioning Valve Setting"
        ]
      }
    ]
  },
  {
    "id": "road_tcr",
    "name": "Touring Car / TCR",
    "description": "FWD",
    "sections": [
      {
        "title": "General Chassis & Setup",
        "fields": [
          "Track / Date / Session",
          "Air Temp / Track Temp",
          "Minimum Racing Mass (kg) / BOP Ballast (kg)",
          "Front Weight (%) / Rear Weight (%)",
          "Static Front Ride Height (mm)",
          "Static Rear Ride Height (mm)",
          "Front Anti-Roll Bar Setting (Soft / Medium / Hard)",
          "Rear Anti-Roll Bar Blade Setting (Stiff / Medium / Soft)",
          "Rear Wing Angle (Degrees / Notch Position)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF - Drive Axle)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (N/mm)",
              "Helper Spring Rate",
              "Camber (Degrees - Typically -4.5 to -5.5)",
              "Toe (mm Toe-Out)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear (mm) & Pad Compound"
            ]
          },
          {
            "title": "Right Front (RF - Drive Axle)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (N/mm)",
              "Helper Spring Rate",
              "Camber (Degrees - Typically -4.5 to -5.5)",
              "Toe (mm Toe-Out)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Brake Disc Wear (mm) & Pad Compound"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (N/mm - Stiffer than Front)",
              "Camber (Degrees)",
              "Toe (mm Toe-In)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Compression Setting (Clicks)",
              "Shock Rebound Setting (Clicks)",
              "Spring Rate (N/mm - Stiffer than Front)",
              "Camber (Degrees)",
              "Toe (mm Toe-In)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)"
            ]
          }
        ]
      },
      {
        "title": "Drivetrain & Differential",
        "fields": [
          "Differential Ramp Angles (Power Ramp / Coast Ramp)",
          "Differential Preload Torque (Nm)",
          "Front Brake Bias (% Front)",
          "ABS Setting Map"
        ]
      }
    ]
  },
  {
    "id": "road_ta2",
    "name": "Trans-Am / TA2",
    "description": "",
    "sections": [
      {
        "title": "General Chassis & Frame",
        "fields": [
          "Track / Date / Session",
          "Weather / Track Temp",
          "Total Weight with Driver (lbs)",
          "Front Weight (lbs / %) / Rear Weight (lbs / %)",
          "Left Weight (lbs / %) / Right Weight (lbs / %)",
          "Cross Weight (%)",
          "Front Frame Height (Inches)",
          "Rear Frame Height (Inches)",
          "Front Sway Bar Size & Link Position",
          "Rear Sway Bar Size & Arm Setting",
          "Rear Stagger (0.0 Inches)"
        ]
      },
      {
        "title": "Four Corners",
        "fields": [],
        "corners": [
          {
            "title": "Left Front (LF)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression (Clicks) / Rebound (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees) / Caster (Degrees) / Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Spindle / Hub Assembly Type"
            ]
          },
          {
            "title": "Right Front (RF)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression (Clicks) / Rebound (Clicks)",
              "Spring Rate (lb/in)",
              "Camber (Degrees) / Caster (Degrees) / Toe (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Spindle / Hub Assembly Type"
            ]
          },
          {
            "title": "Left Rear (LR)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression (Clicks) / Rebound (Clicks)",
              "Spring Rate (lb/in)",
              "Camber Snout Alignment (Degrees)",
              "Toe Snout Alignment (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Truck-Arm Front Mount Hole (1 to 4)"
            ]
          },
          {
            "title": "Right Rear (RR)",
            "fields": [
              "Shock Brand & Model",
              "Shock Compression (Clicks) / Rebound (Clicks)",
              "Spring Rate (lb/in)",
              "Camber Snout Alignment (Degrees)",
              "Toe Snout Alignment (Inches)",
              "Cold Pressure (PSI) / Hot Pressure (PSI)",
              "Tire Temperatures (Inside / Middle / Outside)",
              "Truck-Arm Front Mount Hole (1 to 4)"
            ]
          }
        ]
      },
      {
        "title": "Rear Suspension & Differential",
        "fields": [
          "Panhard Bar Height - Chassis Side (Inches)",
          "Panhard Bar Height - Axle Side (Inches)",
          "Pinion Angle (Degrees)",
          "Differential Type (Spool / Detroit Locker / Torsen)",
          "Rear End Gear Ratio",
          "Front Brake Bias Percentage (% Front)"
        ]
      }
    ]
  }
];

const keyFor = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const cornerIds = ['lf', 'rf', 'lr', 'rr'];
const choices: Record<string, string[]> = {
  'Front Anti-Roll Bar Blade Setting (1 to 7)': ['1', '2', '3', '4', '5', '6', '7'],
  'Rear Anti-Roll Bar Blade Setting (1 to 7)': ['1', '2', '3', '4', '5', '6', '7'],
  'ABS Map Setting (1 to 12)': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  'Control Arm Bushing Type (PB / Delrin / Spherical)': ['PB', 'Delrin', 'Spherical'],
  'Differential Type (Torsen / OS Giken Clutch)': ['Torsen', 'OS Giken Clutch'],
  'Front Dive Planes / Canards Installed (Yes / No)': ['Yes', 'No'],
  'Throttle Pedal Map (Linear / Dynamic)': ['Linear', 'Dynamic'],
  'Front Anti-Roll Bar Setting (Soft / Medium / Hard)': ['Soft', 'Medium', 'Hard'],
  'Rear Anti-Roll Bar Setting (Soft / Medium / Hard)': ['Soft', 'Medium', 'Hard'],
  'Rear Anti-Roll Bar Blade Setting (Stiff / Medium / Soft)': ['Stiff', 'Medium', 'Soft'],
  'Rear Frame Torsion Bar (Installed / Removed)': ['Installed', 'Removed'],
  'Side Bumper / Pod Mounting Bolt Tension (Tight / Loose)': ['Tight', 'Loose'],
  'Front Stub Axle Diameter (17mm / 25mm)': ['17mm', '25mm'],
  'Front Hub Length (75mm / 95mm)': ['75mm', '95mm'],
  'Rear Axle Model & Hardness Rating (Soft / Medium / Hard / Extra Hard)': ['Soft', 'Medium', 'Hard', 'Extra Hard'],
  'Rear Ride Height Frame Mounting Holes (High / Medium / Low)': ['High', 'Medium', 'Low'],
  'Center Axle Bearing Cassette Status (Tight / Free / Removed)': ['Tight', 'Free', 'Removed'],
  'Trailing Arm Chassis Mounting Hole (Top / Middle / Bottom)': ['Top', 'Middle', 'Bottom'],
  'Truck-Arm Front Mount Hole (1 to 4)': ['1', '2', '3', '4'],
  'Differential Type (Spool / Detroit Locker / Torsen)': ['Spool', 'Detroit Locker', 'Torsen'],
};
function fieldsFor(labels: string[], classId: string, sectionId: string, corner?: string): FieldDef[] {
  return labels.map(label => ({ key: (corner ? corner + '_' : '') + keyFor(label), label,
    type: choices[label] ? 'select' : 'text',
    ...(choices[label] ? { options: [{ value: '', label: 'Select' }, ...choices[label].map(value => ({ value, label: value }))] } : {}),
    section: sectionId, applicableClass: classId, applicableCategory: 'road_course' }));
}
export const ROAD_RACING_CLASSES = ROAD_SHEETS.map(sheet => sheet.id);
export const ROAD_RACING_CLASS_CONFIGS: Record<string, ClassConfig> = Object.fromEntries(ROAD_SHEETS.map(sheet => [sheet.id, {
  name: sheet.name, description: sheet.description, category: 'road_course', family: sheet.id === 'road_karts' ? 'kart' : 'road_racing',
  developmentOnly: true, showWingAero: false, showWeightBalance: false, showDrivechain: false,
  generalFields: [], frontCornerFields: [], rearCornerFields: [], suspensionFields: [],
  extraSections: sheet.sections.map((section, index): ClassSection => {
    const id = sheet.id + '_' + index;
    return { id, title: section.title, icon: 'car', fields: section.corners
      ? section.corners.flatMap((corner, i) => fieldsFor(corner.fields, sheet.id, id, cornerIds[i]))
      : fieldsFor(section.fields, sheet.id, id),
      ...(section.corners ? { layout: 'four-corners', cornerTitles: Object.fromEntries(section.corners.map((corner, i) => [cornerIds[i], corner.title])) } : {}) };
  }),
}]));
