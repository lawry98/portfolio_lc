export interface Project {
    id: string;
    title: string;
    description: string;
    tags: string[];
    image: string;
    github?: string;
    live?: string;
  }
  
  export const projects: Project[] = [
    {
      id: "election-analysis",
      title: "2024 Election Analysis",
      description: "Data visualization examining presidential election claims using Observable Framework",
      tags: ["D3.js", "Observable", "Data Viz"],
      image: "/projects/election.png",
      github: "https://github.com/yourusername/election-analysis",
      live: "https://election-analysis.vercel.app",
    },
    {
      id: "house-price-prediction",
      title: "House Price Prediction",
      description: "ML model achieving R² = 0.887 using Random Forest, Ridge, and Linear Regression",
      tags: ["Python", "Scikit-learn", "ML"],
      image: "/projects/house-prices.png",
      github: "https://github.com/yourusername/house-prices",
    },
    {
      id: "survue-detection",
      title: "Survue Object Detection",
      description: "YOLO-based detection system for smart bike lights - humans, traffic signs, vehicles",
      tags: ["YOLO", "Computer Vision", "Python"],
      image: "/projects/survue.png",
    },
    // Add more projects
  ];