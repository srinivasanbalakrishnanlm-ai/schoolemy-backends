// Services/emiService.js - EMI Management
import { sendNotification } from "../Notification/EMI-Notification.js";
import { calculateEmiStatus } from "./EMI-Utils.js";
import EMIPlan from "../Models/Emi-Plan/Emi-Plan-Model.js";
import User from "../Models/User-Model/User-Model.js";

// Lock course access
export const lockCourseAccess = async (userId, courseId, emiPlanId) => {
  await User.updateOne(
    {
      _id: userId,
      "enrolledCourses.course": courseId,
    },
    {
      $set: {
        "enrolledCourses.$.accessStatus": "locked",
      },
    }
  );

  const plan = await EMIPlan.findById(emiPlanId);
  const overdueCount = plan.emis.filter(
    (emi) => emi.status === "pending" && emi.dueDate <= new Date()
  ).length;

  await EMIPlan.findByIdAndUpdate(emiPlanId, {
    $set: { status: "locked" },
    $push: {
      lockHistory: {
        lockDate: new Date(),
        overdueMonths: overdueCount,
      },
    },
  });
 

  sendNotification(userId, "lock", {
    courseId,
    courseName: plan.coursename,
  });
 
};

// Unlock course access
export const unlockCourseAccess = async (userId, courseId, emiPlanId) => {

  await User.updateOne(
    {
      _id: userId,
      "enrolledCourses.course": courseId,
    },
    {
      $set: {
        "enrolledCourses.$.accessStatus": "active",
      },
    }
  );


  const plan = await EMIPlan.findByIdAndUpdate(
    emiPlanId,
    {
      $set: {
        status: "active",
        "lockHistory.$[elem].unlockDate": new Date(),
      },
    },
    {
      arrayFilters: [{ "elem.unlockDate": { $exists: false } }],
      new: true,
    }
  );

  sendNotification(userId, "unlock", {
    courseId,
    courseName: plan.coursename,
  });

};

// Process overdue EMIs
export const processOverdueEmis = async () => {
 
  const today = new Date();
  

  // Find all active EMI plans to check their status
  const activePlans = await EMIPlan.find({
    status: { $in: ["active", "locked"] },
  });


  for (const plan of activePlans) {
    try {
      const emiStatus = calculateEmiStatus(plan);
      let planNeedsUpdate = false;
      let userAccessNeedsUpdate = false;

      // Check if EMIs need status updates (pending -> late)
      const pendingEmisToMarkLate = plan.emis.filter(
        (emi) => emi.status === "pending" && emi.gracePeriodEnd < today
      );

      if (pendingEmisToMarkLate.length > 0) {
        
        // Update EMI status to "late"
        await EMIPlan.updateOne(
          { _id: plan._id },
          {
            $set: {
              "emis.$[elem].status": "late",
            },
          },
          {
            arrayFilters: [
              {
                "elem._id": {
                  $in: pendingEmisToMarkLate.map((emi) => emi._id),
                },
              },
            ],
          }
        );
        planNeedsUpdate = true;
      }

      // Check if plan needs to be locked due to overdue payments
      if (emiStatus.hasOverduePayments && plan.status === "active") {
        
        await EMIPlan.findByIdAndUpdate(plan._id, {
          $set: { status: "locked" },
          $push: {
            lockHistory: {
              lockDate: today,
              overdueMonths: emiStatus.overdueCount,
              reasonForLock: `Auto-locked: ${emiStatus.overdueCount} overdue EMI(s)`,
              lockedBy: "system",
            },
          },
        });

        // Update user course access
        await User.updateOne(
          {
            _id: plan.userId,
            "enrolledCourses.course": plan.courseId,
          },
          {
            $set: {
              "enrolledCourses.$.accessStatus": "locked",
            },
          }
        );

        userAccessNeedsUpdate = true;

        // Send notification
        sendNotification(plan.userId, "lock", {
          courseId: plan.courseId,
          courseName: plan.coursename,
          overdueCount: emiStatus.overdueCount,
          overdueAmount: emiStatus.totalOverdue,
        });
      }

      // Check if plan should be unlocked (if was locked but now payments are current)
      else if (!emiStatus.hasOverduePayments && plan.status === "locked") {
          
        await EMIPlan.findByIdAndUpdate(
          plan._id,
          {
            $set: {
              status: "active",
              "lockHistory.$[elem].unlockDate": today,
            },
          },
          {
            arrayFilters: [{ "elem.unlockDate": { $exists: false } }],
          }
        );

        // Update user course access
        await User.updateOne(
          {
            _id: plan.userId,
            "enrolledCourses.course": plan.courseId,
          },
          {
            $set: {
              "enrolledCourses.$.accessStatus": "active",
            },
          }
        );

        userAccessNeedsUpdate = true;

        // Send notification
        sendNotification(plan.userId, "unlock", {
          courseId: plan.courseId,
          courseName: plan.coursename,
        });
      }

          } catch (error) {
            return { success: false, error: error.message };
    }
  }

};

// Send payment reminders
export const sendPaymentReminders = async () => {
    const today = new Date();
  const reminderDate = new Date(today);
  reminderDate.setDate(today.getDate() + 5);
  
  const upcomingEmis = await EMIPlan.aggregate([
    {
      $match: {
        status: "active",
        "emis.status": "pending",
      },
    },
    {
      $unwind: "$emis",
    },
    {
      $match: {
        "emis.status": "pending",
        "emis.dueDate": {
          $gte: today,
          $lte: reminderDate,
        },
      },
    },
  ]);
  
  for (const { emis, ...plan } of upcomingEmis) {
    sendNotification(plan.userId, "reminder", {
      courseName: plan.coursename,
      dueDate: emis.dueDate,
      amount: emis.amount,
    });
      }
};

// Fix EMI status inconsistencies for a specific user and course
export const fixEmiStatusForUser = async (userId, courseId) => {
  
  try {
    // Find the EMI plan
    const emiPlan = await EMIPlan.findOne({ userId, courseId });
    if (!emiPlan) {
            return { success: false, message: "No EMI plan found" };
    }

    // Calculate current status
    const emiStatus = calculateEmiStatus(emiPlan);
    
    let planUpdated = false;
    let userUpdated = false;

    // Update EMI statuses if needed
    const today = new Date();
    const pendingEmisToMarkLate = emiPlan.emis.filter(
      (emi) => emi.status === "pending" && emi.gracePeriodEnd < today
    );

    if (pendingEmisToMarkLate.length > 0) {
            await EMIPlan.updateOne(
        { _id: emiPlan._id },
        {
          $set: {
            "emis.$[elem].status": "late",
          },
        },
        {
          arrayFilters: [
            {
              "elem._id": { $in: pendingEmisToMarkLate.map((emi) => emi._id) },
            },
          ],
        }
      );
      planUpdated = true;
    }

    // Update plan status based on current EMI status
    const correctPlanStatus = emiStatus.hasAccessToContent
      ? "active"
      : "locked";
    if (emiPlan.status !== correctPlanStatus) {
      
      const updateData = { status: correctPlanStatus };

      // Add lock history if locking
      if (correctPlanStatus === "locked") {
        updateData.$push = {
          lockHistory: {
            lockDate: today,
            overdueMonths: emiStatus.overdueCount,
            reasonForLock: "Auto-fix: EMI status correction",
            lockedBy: "system",
          },
        };
      } else if (emiPlan.status === "locked") {
        // Update latest lock history with unlock date
        updateData.$set = {
          ...updateData,
          "lockHistory.$[elem].unlockDate": today,
        };
        updateData.$arrayFilters = [{ "elem.unlockDate": { $exists: false } }];
      }

      await EMIPlan.findByIdAndUpdate(emiPlan._id, updateData);
      planUpdated = true;
    }

    // Update user course access
    const user = await User.findOne(
      {
        _id: userId,
        "enrolledCourses.course": courseId,
      },
      { "enrolledCourses.$": 1 }
    );

    if (user && user.enrolledCourses[0]) {
      const correctAccessStatus = emiStatus.hasAccessToContent
        ? "active"
        : "locked";
      const currentAccessStatus = user.enrolledCourses[0].accessStatus;

      if (currentAccessStatus !== correctAccessStatus) {
                await User.updateOne(
          {
            _id: userId,
            "enrolledCourses.course": courseId,
          },
          {
            $set: {
              "enrolledCourses.$.accessStatus": correctAccessStatus,
            },
          }
        );
        userUpdated = true;
      }
    }

    
    return {
      success: true,
      planUpdated,
      userUpdated,
      emiStatus: {
        ...emiStatus,
        planStatus: correctPlanStatus,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Bulk fix all EMI status inconsistencies
export const fixAllEmiStatusInconsistencies = async () => {
  
  try {
    const allPlans = await EMIPlan.find({
      status: { $in: ["active", "locked"] },
    });

    
    let fixed = 0;
    let errors = 0;

    for (const plan of allPlans) {
      try {
        const result = await fixEmiStatusForUser(plan.userId, plan.courseId);
        if (result.success && (result.planUpdated || result.userUpdated)) {
          fixed++;
        }
      } catch (error) {
        
        errors++;
      }
    }

    
    return { success: true, fixed, errors, total: allPlans.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
