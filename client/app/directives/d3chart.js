(function() {
  'use strict';

  /**
    * @ngdoc directive
    * @name demouiApp.directive:d3Chart
    * @description
    * # d3Chart
    */
  angular.module('demouiApp.directives')
    .directive('d3Chart', function () {
      return {
        template: '<div></div>',
        restrict: 'EA',
        scope: {
            data: '=', // bi-directional data-binding
            properties: '=', // bi-directional data-binding
            refreshInterval: '=', // bi-directional data-binding
            interactionController: '='
        },
        replace: false,
        link: function postLink(scope, element, attrs) {

          /**
           * The createLineGenerators function creates a line generator for each
           * of the number properties defined by the selected application
           * interface schema.
           */
          scope.createLineGenerators = function() {
            scope.properties.forEach( function(property, index) {
                var lineGenerator = d3.svg.line()
                    .interpolate("monotone") // Smooth the line
                    .x(function(d) { return xRange(d.timestamp); })
                    .y(function(d) { return yRange(d[property.name]);});
                lineGenerators[property.name] = lineGenerator;

                scope.createLine(property, index);

              }
            );
          }

          /**
           * The createLine function creates a line on the chart for the
           * specified property.  The index specified determines the color that
           * will be used for the line.
           */
          scope.createLine = function(property, index) {
            chart.append("path")
              .attr("id", property.name + '_line')
              .attr("class", "line")
              .attr("clip-path", "url(#" + attrs.id + "_clip)")
              .attr("d", lineGenerators[property.name](scope.data))
              .attr("transform", null)
              .attr("fill", colorScale[index])
              .attr("stroke", colorScale[index]);
          }

          /**
           * The setLineHighlight function modifies the style of the line for
           * the specified resource based on the value of the highlight flag
           * passed in. A value of true will highlight the line.  A value of
           * false will remove the highlight.
           *
           * @param propertyName
           *          The name of the property represented by the line.
           * @param highlight
           *          A flag to indicate whether the line should be highlighted.
           *          True to add a highlight, false to remove the highlight.
           */
          scope.interactionController.highlightLine = function(propertyName, highlight) {
            // Attempt to retrieve the line
            var line = chart.select("#" + propertyName + '_line');
            if (!line.empty()) {
              line.classed("hover", highlight);
            }
          }

          scope.interactionController.toggleLine = function($event, lineId) {
            // Attempt to retrieve the line
            var line = chart.select("#" + lineId + '_line');

            // Now check to see if we need to add or remove the line
            if ($event.target.checked) {
              if (line.empty()) {
                for (var index = 0; index < scope.properties.length; index++) {
                  var property = scope.properties[index];
                  if (property.name === lineId) {
                    scope.createLine(property, index);
                    break;
                  }
                } // FOR
              }
            } else {
                if (!line.empty()) {
                  line.remove();
                }
            }
          }

          scope.interactionController.toggleAllLines = function($event) {
            if (scope.data) {
              for (var index = 0; index < scope.properties.length; index++) {
                scope.interactionController.toggleLine($event, scope.properties[index].name);
              } // FOR
              document.querySelectorAll("input").forEach(function(checkbox) {
                checkbox.checked = $event.target.checked;
              });
            }
          }

          /**
           * The getDomainEndTime function calculates the end time that should
           * be used when defining the domain of the x axis.  Typically, the
           * value returned is the time of the last update in the data set.  It
           * defaults to the session start time if the data set is empty.
           *
           * @return endTime
           *           The end time to be used when rendering the x axis...
           *           format is the number of millis since epoch.
           */
          scope.getDomainEndTime = function() {
            var endTime = 0;
            if (scope.data) {
              if (scope.data.length > 0) {
                var datum = scope.data[scope.data.length - 1];
                endTime = datum.timestamp;
              }
            }

            // Check to see if we found a valid endTime
            if (endTime == 0) {
              endTime = sessionStartTime;
            }

            return endTime;
          }

          /**
           * The renderDataPoints function renders circles for each of the data
           * points on lines displayed within the chart whenever the mouse
           * enters the chart.
           */
          scope.renderDataPoints = function() {
            /*
             * The name of each property is used as part of the id for the
             * corresponding lines in the chart.  Iterate over the properties
             * and check to make sure that a line with the specified id is
             * currently being displayed.
             */
            scope.properties.forEach( function(property, index) {
              // Attempt to retrieve the lines with specified id
              var line = chart.select("#" + property.name + '_line');

              // Only render the datapoints if the lines exist
              if (!line.empty()) {
                // Create the data points
                var datePoints =
                  chart.selectAll("circle[id^='" + property.name + "_circle']")
                    .data(scope.data)
                    .enter()
                    .append("circle")
                      .attr("r", 3)
                      .attr("id", function(d) {
                        return property.name + "_circle_" + d.timestamp;
                      })
                      .attr("clip-path", "url(#" + attrs.id + "_clip)")
                      .attr("cx", function(d) {
                        return xRange(d.timestamp + scope.refreshInterval);
                      })
                      .attr("cy", function(d) {
                        return yRange(d[property.name]);
                      })
                      .attr("transform", null)
                      .attr("fill", function() {
                        return colorScale[index];
                      })
                      .attr("stroke", function() {
                        return colorScale[index];
                      })
                      .on("mouseover", function(d) {
                        tooltip.html(d[property.name])
                          .style("left", (d3.event.pageX) + "px")
                          .style("top", (d3.event.pageY - 28) + "px")
                          .style("opacity", .9);
                      })
                      .on("mouseout", function(d) {
                        tooltip.style("opacity", 0);
                      });
              }
            }); // FOR
          } // renderDataPoints

          /**
           * The removeDataPoints function removes any data points (circles)
           * that are being displayed on the chart whenever the mouse leaves the
           * chart.
           */
          scope.removeDataPoints = function() {
              chart.selectAll("circle").remove();
          } // REMOVEDATAPOINTS

          /**
           * The refresh function refreshes the chart on the glass using the
           * most recent data available for the session.
           */
          scope.refresh = function() {
            var currentDomain = xRange.domain();
            var currentStartTime = currentDomain[0];

            // Animate the changes using a transition
            var t = chart.transition()
              .duration(750)
              .ease("linear");

              /*
               * Check to see if we are currently showing any data points on the
               * chart and, if we are, add in any new data points that are
               * required for the resource data.
               */
              var circle = chart.select("circle");
              if (!circle.empty()) {
                scope.renderDataPoints();
              }

              // Now update each of the lines on the chart.
              for (var index = 0; index < scope.properties.length; index++) {
                var property = scope.properties[index];
                t.select("#" + property.name + '_line')
                  .attr("d", lineGenerators[property.name](scope.data))
                  .attr("transform", null);

                /*
                 * Check to see if there are any circles drawn for the data
                 * points on the current line and, if there are, transform these
                 * as part of the same transition.
                 */
                t.selectAll("circle[id^='" + property.name + "_circle']")
                  .attr("cx", function(d) {
                    return xRange(d.timestamp);
                  })
                  .attr("cy", function(d) {
                    return yRange(d[property.name]);
                  })
                  .attr("transform", null);
              } // FOR

              /*
               * The x axis represents time.  Calculate the new extent of the x
               * domain and update the x axis.
               */
              var endTime = this.getDomainEndTime();
              var startTime = endTime - sessionWindow;
              xRange.domain([startTime, endTime]);
              t.select(".x.DeviceStateChartAxis").call(xAxis)
                .selectAll("text")
                .attr("y", "10");
          } // refresh

          // Watch for changes to the properties
          scope.$watch('properties', function(newVals, oldVals) {
            scope.createLineGenerators();
          }, true);

          // Watch for data changes and re-render
          scope.$watch('data', function(newVals, oldVals) {
            scope.refresh();
          }, true);

        // Set the width of the chart to the width of the state table
        var chartDiv = document.getElementById("stateTable")
        var height = 500;
        var width = chartDiv.clientWidth;
        var chartMargins = {top: 10, right: 15, bottom: 20, left: 25};
        var chartWidth  = width - chartMargins.left - chartMargins.right;
        var chartHeight = height - chartMargins.top  - chartMargins.bottom;
        var sessionStartTime = Date.now();
        var sessionWindow = 60000; // 1 minute

        /*
         * Now define the the scales and axes.  We want to scale the axes so
         * that they fit the width and height of the chart.
         */
        var colorScale = d3.scale.category10().range();
        var xRange = d3.time.scale().range([0, chartWidth]);
        var yRange = d3.scale.linear().range([chartHeight, 0]);
        var xAxis = d3.svg.axis().scale(xRange)
          .orient("bottom")
          .ticks(5)
          .tickFormat(d3.time.format("%X"))
          .tickSize(-chartHeight)
          .tickSubdivide(true);
        var yAxis = d3.svg.axis().scale(yRange)
          .orient("left")
          .ticks(5)
          .tickSize(-chartWidth)
          .tickSubdivide(true);

        var lineGenerators = {};

        /*
         * Now create the actual chart.  This is actually an SVG element that
         * fills the space available for the chart.  A g element is then appended
         * as a child of the SVG element and is used to group all of the remaining
         * SVG elements for the chart.  This g element is, in effect, the chart.
         */
        var tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
        var chart = d3.select(element[0]).append("svg")
            .attr("id", attrs.id + "_svg")
            .attr("width", width)
            .attr("height", height)
          .append("g")
            .attr("transform", "translate(" + chartMargins.left + "," + chartMargins.top + ")")
            .attr("width", width)
            .attr("height", height)
            .attr("pointer-events", "all")
            .on("mouseenter", function() {
              scope.renderDataPoints();
            })
            .on("mouseleave", function() {
              scope.removeDataPoints();
            });

        // Add the clip path
        chart.append("clipPath")
            .attr("id", attrs.id + "_clip")
          .append("rect")
            .attr("id", attrs.id + "_clip-rect")
            .attr("width", chartWidth)
            .attr("height", chartHeight);

        /*
         * Now create the actual x and y axes for the chart.  If there is no data
         * then simply define some dummy domains to ensure that something sensible
         * is rendered.
         */
        var endTime = scope.getDomainEndTime();
        var startTime = endTime - sessionWindow;
        xRange.domain([startTime, endTime]);
        yRange.domain([0, 100]).nice();
        var chartLayer = chart.append("g");
        chartLayer.append("g")
          .attr("class", "x DeviceStateChartAxis")
          .attr("transform", "translate(0," + chartHeight + ")")
          .call(xAxis)
            .selectAll("text")
            .attr("y", "10");
        chartLayer.append("g")
            .attr("class", "y DeviceStateChartAxis")
            .call(yAxis);
      }
    };
  });
})();
