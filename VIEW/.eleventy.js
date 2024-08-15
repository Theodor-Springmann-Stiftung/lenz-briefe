module.exports = function (config) {

    // Set static folder, which copntent will be copied to the output folder
    config.addPassthroughCopy({ "src/static/": "/" });

    return { 
        // Set custom directories for dynamic pages, data, includes, layouts and finally the generated output
        dir: 
            { 
                input: "src/dynamic", 
                layouts: "../layouts",
                includes: "../includes", 
                data: "../data", 
                output: "./SITE" 
            },
            
        // Set template formats so that other files won't be included in dist
        templateFormats: ["njk", "md", "html"]
    };
};
