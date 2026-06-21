// 기존 CSS 선언
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// 🌟 소문자 .png 선언
declare module '*.png' {
  const value: string;
  export default value;
}