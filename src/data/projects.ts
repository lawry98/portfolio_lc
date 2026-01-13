export interface Project {
    id: string;
    title: string;
    description: string;
    tags: string[];
    image?: string;
    github?: string;
    live?: string;
    featured?: boolean;
  }
  
  export const projects: Project[] = [
    {
      id: "election-analysis",
      title: "2024 Election Analysis",
      description:
        "Interactive data visualization examining presidential election fraud claims through evidence-based analysis using MIT Election Lab data and Observable Framework.",
      tags: ["D3.js", "Observable", "Data Visualization", "JavaScript"],
      image: "/projects/election.png",
      github: "https://github.com/lawry98/election-analysis",
      live: "https://election-analysis.vercel.app",
      featured: true,
    },
    {
      id: "house-price-prediction",
      title: "House Price Prediction",
      description:
        "Machine learning system achieving R² = 0.887 using ensemble methods including Random Forest, Ridge Regression, and Linear Regression for accurate price forecasting.",
      tags: ["Python", "Scikit-learn", "Machine Learning", "Pandas"],
      image: "/projects/house-prices.png",
      github: "https://github.com/lawry98/house-prices",
      featured: true,
    },
    {
      id: "survue-detection",
      title: "Survue Object Detection",
      description:
        "Computer vision system for smart bike lights using YOLO models trained to detect humans, traffic signs, and vehicles in real-time for cyclist safety.",
      tags: ["YOLO", "Computer Vision", "Python", "PyTorch"],
      image: "/projects/survue.png",
      github: "https://github.com/lawry98/survue",
      featured: true,
    },
    {
      id: "stackoverflow-analysis",
      title: "Stack Overflow Trends",
      description:
        "Comprehensive analysis of Developer Survey data from 2017-2021, examining programming language trends, salary disparities, and technology adoption patterns.",
      tags: ["Python", "Data Analysis", "Visualization", "Pandas"],
      image: "/projects/stackoverflow.png",
      github: "https://github.com/lawry98/stackoverflow-analysis",
    },
    {
      id: "stellar-classification",
      title: "Stellar Classification",
      description:
        "Deep learning model for classifying celestial objects using spectroscopic data, implementing neural networks for astronomical object categorization.",
      tags: ["TensorFlow", "Deep Learning", "Python", "Astronomy"],
      image: "/projects/stellar.png",
      github: "https://github.com/lawry98/stellar-classification",
    },
    {
      id: "recommendation-system",
      title: "Game Recommendation Engine",
      description:
        "Collaborative filtering recommendation system built on Amazon video game review data to suggest personalized game recommendations to users.",
      tags: ["Python", "Recommender Systems", "NLP", "Scikit-learn"],
      image: "/projects/recommendations.png",
      github: "https://github.com/lawry98/game-recommendations",
    },
  ];
  
  export const featuredProjects = projects.filter((p) => p.featured);